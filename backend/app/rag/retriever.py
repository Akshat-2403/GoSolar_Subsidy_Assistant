"""Offline policy retrieval and optional free-tier Gemini policy assessment."""
from __future__ import annotations

import hashlib
import os
import re
from functools import lru_cache
from typing import Any

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings


# Curated baseline passages from the official sources below. The index is rebuilt
# locally at process start and never makes embedding or vector-store API calls.
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
]


class HashEmbeddings(Embeddings):
    """Deterministic local token vectors; no model download, network, or API cost."""

    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    def _embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for token in re.findall(r"[a-z0-9]+", text.casefold()):
            digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
            vector[int.from_bytes(digest, "big") % self.dimensions] += 1.0
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
        ranked = sorted(
            self.rows,
            key=lambda row: self._cosine(query_vector, row[1]),
            reverse=True,
        )
        return [doc for doc, _vector in ranked[:k]]


@lru_cache(maxsize=1)
def _store() -> PolicyInMemoryVectorStore:
    documents = [
        Document(
            page_content=chunk,
            metadata={
                "source_id": source["id"],
                "source_title": source["title"],
                "source_url": source["url"],
                "chunk_index": index,
            },
        )
        for source in SOURCES
        for index, chunk in enumerate(_split(source["text"]))
    ]
    return PolicyInMemoryVectorStore(documents, HashEmbeddings())


def retrieve_policy_evidence(
    query: str,
    *,
    rule_applied: str,
    k: int = 2,
    source_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Return locally retrieved records with source metadata and text snippets."""
    store = _store()
    matches = store.similarity_search(query, k=len(store.rows))
    if source_ids:
        matches = [doc for doc in matches if doc.metadata["source_id"] in source_ids]
    evidence = []
    for index, doc in enumerate(matches[:k]):
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
    """Use Gemini only when a key is explicitly provided; never call paid embeddings."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return (
            "Offline policy retrieval completed. Add GEMINI_API_KEY to enable the optional "
            "Gemini free-tier assessment; no external AI or embedding API was called."
        )

    from langchain_google_genai import ChatGoogleGenerativeAI

    context = "\n\n".join(
        f"Source: {item['source_title']} ({item['source_url']})\n"
        f"Retrieved passage: {item['verbatim_snippet']}"
        for item in evidence
    )
    model = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        api_key=api_key,
        temperature=0,
        max_retries=0,
    )
    result = model.invoke(
        "Assess the application question using only the cited passages. Do not invent "
        "rules or infer eligibility beyond the text. State uncertainty and require human "
        "verification when the source does not resolve a point."
        f"\nQuestion: {query}\nEvidence:\n{context}"
    )
    return str(result.content)
