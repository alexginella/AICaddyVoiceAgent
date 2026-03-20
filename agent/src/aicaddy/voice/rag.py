"""
RAG over course yardage book PDFs using LlamaIndex and Chroma.
Per-course indexes are built by the Course Guide Service; the voice agent loads them read-only.
"""

import logging
import os

from aicaddy.guide.common import (
    chroma_collection_name_for_course,
    chroma_collection_name_for_pdf_stem,
    chroma_collection_vector_count_for_collection,
    index_slug,
    vector_store_dir,
)

logger = logging.getLogger(__name__)

_course_lookups: dict[str, object] = {}


async def noop_rag_lookup(query: str) -> str:
    """No retrieval (no per-course index or not configured)."""
    return ""


def is_noop_rag_lookup(lookup_fn) -> bool:
    """True when lookup is the no-op (no retrieval), including failed init paths."""
    return lookup_fn is noop_rag_lookup


def _per_course_collection_and_count(
    course_name: str, *, guide_pdf_stem: str | None
) -> tuple[str | None, int | None]:
    stem = (guide_pdf_stem or "").strip()
    display = (course_name or "").strip()
    if stem:
        coll = chroma_collection_name_for_pdf_stem(stem)
    elif display:
        coll = chroma_collection_name_for_course(course_name)
    else:
        return None, None
    return coll, chroma_collection_vector_count_for_collection(coll)


async def get_rag_for_course(
    course_name: str,
    *,
    guide_pdf_stem: str | None = None,
):
    """
    Load RAG lookup for a course from an existing Chroma index only.
    Does not generate PDFs or build indexes (Course Guide Service must run first).

    Prefer ``guide_pdf_stem`` (from ensure-guide / PDF filename stem) so the collection
    matches the indexed file even if ``course_name`` differs from the string used at index time.
    """
    stem = (guide_pdf_stem or "").strip()
    display = (course_name or "").strip()
    if not stem and not display:
        return noop_rag_lookup

    cache_key = stem or index_slug(display)
    if cache_key in _course_lookups:
        return _course_lookups[cache_key]

    try:
        import chromadb
        from llama_index.core import Settings, VectorStoreIndex
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
    except ImportError:
        return noop_rag_lookup

    if not os.environ.get("OPENAI_API_KEY"):
        return noop_rag_lookup

    coll_name, n = _per_course_collection_and_count(
        course_name, guide_pdf_stem=guide_pdf_stem
    )
    if not coll_name or n is None or n == 0:
        return noop_rag_lookup

    persist_dir = vector_store_dir()
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    try:
        chroma_collection = chroma_client.get_collection(coll_name)
    except Exception:
        return noop_rag_lookup

    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    try:
        index = VectorStoreIndex.from_vector_store(vector_store)
    except Exception:
        return noop_rag_lookup

    qe = index.as_query_engine(similarity_top_k=3)

    def _lookup(query: str) -> str:
        try:
            result = qe.query(query)
            return str(result).strip() if result else ""
        except Exception:
            logger.exception("RAG query failed (per-course index)")
            return ""

    async def _async_lookup(query: str) -> str:
        return _lookup(query)

    _course_lookups[cache_key] = _async_lookup
    return _async_lookup
