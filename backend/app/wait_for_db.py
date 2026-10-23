import asyncio
import logging
import sys

import asyncpg
from sqlalchemy.engine import make_url

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("wait-for-db")


async def wait_for_database(attempts: int = 60) -> None:
    url = make_url(settings.database_url).set(drivername="postgresql")
    dsn = url.render_as_string(hide_password=False)
    for attempt in range(1, attempts + 1):
        try:
            connection = await asyncpg.connect(dsn=dsn)
            await connection.execute("SELECT 1")
            await connection.close()
            logger.info("PostgreSQL доступен.")
            return
        except Exception as exc:
            logger.info(
                "Ожидание PostgreSQL (%s/%s): %s", attempt, attempts, exc
            )
            await asyncio.sleep(1)
    logger.error("PostgreSQL недоступен, завершение.")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(wait_for_database())
