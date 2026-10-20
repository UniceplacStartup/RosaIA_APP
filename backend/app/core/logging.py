import logging
import sys
from typing import Any, Dict


def setup_logging() -> logging.Logger:
    """Configura o sistema de log estruturado para auditoria de segurança (OWASP A09)."""
    logger = logging.getLogger("rosaia_backend")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()


def log_security_event(event_type: str, ip_hash: str, details: Dict[str, Any]) -> None:
    """Registra evento de auditoria sem expor PII em texto puro (LGPD Art. 37 & OWASP A09)."""
    logger.info(
        f"AUDIT_EVENT | Type={event_type} | IP_Hash={ip_hash[:16]}... | Details={details}"
    )
