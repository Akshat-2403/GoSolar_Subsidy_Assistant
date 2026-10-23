"""Policy source ingestion and semantic retrieval.

Official source PDFs/pages are fetched on first use, chunked, embedded with OpenAI,
and indexed in a lightweight in-memory cosine vector store using LangChain document and embedding interfaces. A small exact-source
corpus keeps local demos usable when the provider key or network is unavailable.
"""
from __future__ import annotations

import os
import re
import urllib.request
from functools import lru_cache
from typing import Any

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings


SOURCES = [
    {
        "id": "mnre-pmsg",
        "title": "MNRE Grid Connected Rooftop Solar Programme / PM Surya Ghar",
        "url": "https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/",
        "text": (
            "Central Financial Assistance (CFA) is provided to residential electricity consumers. "
            "A residential consumer applies for installation of grid connected rooftop solar through "
            "the National Portal for Rooftop Solar or a State DISCOM portal. Under the National Portal "
            "mechanism, CFA is transferred directly to the consumer after successful installation by "
            "empanelled vendors and verification by State DISCOMs."
        ),
    },
    {
        "id": "msedcl-guidelines",
        "title": "MSEDCL General Guidelines for Rooftop Solar Connectivity",
        "url": "https://www.mahadiscom.in/consumer/wp-content/uploads/2018/03/General-Guidelines.pdf",
        "text": (
            "An LT/HT consumer in MSEDCL's area intending to install a rooftop solar PV system below "
            "1 MW to meet all or part of their own electricity load requirement is eligible to seek "
            "connectivity with MSEDCL's network. The cumulative capacity of rooftop solar systems under "
            "net metering connected to a distribution transformer shall not exceed 40 percent of its "
            "rated capacity; capacity beyond that may be considered after a detailed load study."
        ),
    },
    {
        "id": "msedcl-capacity-2025",
        "title": "MSEDCL Guidelines for PV Capacity and Sanctioned Load (7 January 2025)",
        "url": "https://www.mahadiscom.in/ismart/media/PV_CAPACITY_INVERTER_GUIDELINES.pdf",
        "text": (
            "The capacity of the Renewable Energy Generating System to be connected at the Eligible "
            "Consumer's premises under any of the three arrangements shall not exceed the Sanctioned "
            "load (in kW) or the Contract Demand (in kVA) of the Consumer, as applicable. For arriving "
            "at eligible capacity, the capacity of the Renewable Energy Generating System shall be "
            "reckoned based on its output capacity in AC."
        ),
    },
    {
        "id": "msedcl-portal",
        "title": "MSEDCL Rooftop Net Metering consumer guidance",
        "url": "https://www.mahadiscom.in/en/consumer/re-rooftop-net-metering/",
        "text": (
            "RE Rooftop Net Metering. General Guidelines for the consumers desiring connectivity of "
            "Roof-top Renewable Energy Generating System with MSEDCL's Network under MERC Net Metering "
            "Regulations, 2015. ANNEXURE-1 Procedure for Net Metering."
        ),
    },
]


class HashEmbeddings(Embeddings):
    """Offline deterministic token-vector fallback; OpenAI embeddings are preferred."""
    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    def _embed(self, text: str) -> list[float]:
        import hashlib
        vector = [0.0] * self.dimensions
        tokens = re.findall(r"[a-z0-9]+", text.casefold())
        for token in tokens:
            digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
            index = int.from_bytes(digest, "big") % self.dimensions
            vector[index] += 1.0
        norm = sum(value * value for value in vector) ** 0.5 or 1.0
        return [value / norm for value in vector]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


def _split(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return []
    return [clean[start:start + size] for start in range(0, len(clean), size - overlap)]


def _download_source(source: dict[str, str]) -> list[Document]:
    """Best-effort refresh from official URL; preserve cited snippets in offline mode."""
    text = source["text"]
    try:
        request = urllib.request.Request(source["url"], headers={"User-Agent": "RooftopSolarPolicyAssistant/1.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read(12_000_000)
        if raw.startswith(b"%PDF"):
            from pypdf import PdfReader
            import io
            extracted = " ".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)
            if extracted.strip():
                text = extracted
        elif b"<html" in raw[:2048].lower() or b"<!doctype" in raw[:2048].lower():
            from html.parser import HTMLParser
            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__(); self.parts: list[str] = []
                def handle_data(self, data: str) -> None:
                    if data.strip(): self.parts.append(data.strip())
            parser = TextExtractor()
            parser.feed(raw.decode("utf-8", errors="ignore"))
            extracted = " ".join(parser.parts)
            if extracted.strip():
                text = extracted
    except Exception:
        pass
    return [
        Document(page_content=chunk, metadata={
            "source_id": source["id"], "source_title": source["title"],
            "source_url": source["url"], "chunk_index": index,
        })
        for index, chunk in enumerate(_split(text))
    ]


class PolicyInMemoryVectorStore:
    def __init__(self, documents: list[Document], embeddings: Embeddings):
        self.embeddings = embeddings
        self.rows = [(doc, embeddings.embed_query(doc.page_content)) for doc in documents]

    @staticmethod
    def _cosine(left: list[float], right: list[float]) -> float:
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = sum(value * value for value in left) ** 0.5
        right_norm = sum(value * value for value in right) ** 0.5
        return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0

    def similarity_search(self, query: str, k: int = 4) -> list[Document]:
        query_vector = self.embeddings.embed_query(query)
        ranked = sorted(self.rows, key=lambda row: self._cosine(query_vector, row[1]), reverse=True)
        return [doc for doc, _vector in ranked[:k]]


@lru_cache(maxsize=1)
def _store() -> PolicyInMemoryVectorStore:
    refresh = os.getenv("POLICY_REFRESH_SOURCES", "false").casefold() == "true"
    documents = []
    for source in SOURCES:
        if refresh:
            documents.extend(_download_source(source))
        else:
            documents.extend(
                Document(page_content=chunk, metadata={
                    "source_id": source["id"], "source_title": source["title"],
                    "source_url": source["url"], "chunk_index": index,
                })
                for index, chunk in enumerate(_split(source["text"]))
            )
    if os.getenv("OPENAI_API_KEY"):
        from langchain_openai import OpenAIEmbeddings
        embeddings: Embeddings = OpenAIEmbeddings(
            model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        )
    else:
        embeddings = HashEmbeddings()
    return PolicyInMemoryVectorStore(documents, embeddings)


def retrieve_policy_evidence(query: str, *, rule_applied: str, k: int = 2, source_ids: set[str] | None = None) -> list[dict[str, Any]]:
    """Return source-grounded records with a snippet copied verbatim from indexed text."""
    store = _store()
    matches = store.similarity_search(query, k=len(store.rows))
    if source_ids:
        matches = [doc for doc in matches if doc.metadata["source_id"] in source_ids]
    matches = matches[:k]
    evidence = []
    for index, doc in enumerate(matches):
        snippet = re.sub(r"\s+", " ", doc.page_content).strip()[:700]
        evidence.append({
            "evidence_id": f"{doc.metadata['source_id']}-{doc.metadata['chunk_index']}-{index}",
            "rule_applied": rule_applied,
            "source_title": doc.metadata["source_title"],
            "verbatim_snippet": snippet,
            "source_url": doc.metadata["source_url"],
        })
    return evidence


def policy_reasoning(query: str, evidence: list[dict[str, Any]]) -> str:
    """Use the configured LangChain chat model when credentials are present."""
    if not os.getenv("OPENAI_API_KEY"):
        return "Provider key not configured; policy evidence was retrieved using the local in-memory semantic index."
    from langchain_openai import ChatOpenAI
    context = "\n\n".join(
        f"Source: {item['source_title']} ({item['source_url']})\nVerbatim: {item['verbatim_snippet']}"
        for item in evidence
    )
    model = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        timeout=20,
        max_retries=1,
    )
    result = model.invoke(
        "Assess the application question using only the cited evidence. "
        "Do not invent policy rules or infer eligibility beyond the text. "
        "State uncertainty and say when a human must verify. "
        f"\nQuestion: {query}\nEvidence:\n{context}"
    )
    return str(result.content)
