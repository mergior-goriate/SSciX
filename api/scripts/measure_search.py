"""Measure authenticated search in an isolated staging environment."""

import argparse
import math
from concurrent.futures import ThreadPoolExecutor
from os import environ
from time import perf_counter
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="Endereço da instância de ensaio")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.requests <= 100_000 or not 1 <= args.workers <= 100:
        parser.error("Indique entre 1 e 100 000 pedidos e entre 1 e 100 trabalhadores.")
    cookie = environ["SSCIX_STAGING_COOKIE"]
    queries = ("solos salinos", '"solos salinos"', "salinnos", "alterações climáticas")

    def measure(index):
        query = urlencode({"q": queries[index % len(queries)], "page_size": 20})
        request = Request(f"{args.base.rstrip('/')}/api/v1/feed?{query}", headers={"Cookie": cookie})
        start = perf_counter()
        try:
            with urlopen(request, timeout=5) as response:
                response.read()
                return (perf_counter() - start) * 1000 if response.status == 200 else None
        except OSError:
            return None

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(measure, range(args.requests)))
    times = sorted(value for value in results if value is not None)
    failures = len(results) - len(times)
    if not times:
        raise SystemExit("Nenhum pedido de pesquisa foi concluído.")
    p95 = times[math.ceil(len(times) * .95) - 1]
    print(f"Pesquisas concluídas: {len(times)}/{len(results)} | Erros: {failures} | p95: {p95:.1f} ms")
    raise SystemExit(int(bool(failures) or p95 > 300))


if __name__ == "__main__":
    main()
