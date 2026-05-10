#!/usr/bin/env python3
import json
import re
import sys
import requests
from bs4 import BeautifulSoup

SITEREF = "src/assets/siteref.txt"
OUTPUT = "src/assets/items.json"


def load_urls(path):
    urls = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # lines may be tab-separated with a leading index
            parts = line.split(None, 1)
            url = parts[-1]
            if url.startswith("http"):
                urls.append(url)
    return urls


def extract_subcategory(soup):
    """Find the 'List of X Items' heading and return X."""
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "b", "td"]):
        text = tag.get_text(strip=True)
        m = re.search(r"List of (.+?) Items", text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _header_cells(row):
    """Return td or th cells from a row."""
    cells = row.find_all("th")
    return cells if cells else row.find_all("td")


def extract_items(soup, subcategory):
    items = []

    # Find the items table: first row has Picture/Name/Description/Category cells
    table = None
    for candidate in soup.find_all("table"):
        first_row = candidate.find("tr")
        if not first_row:
            continue
        headers = [c.get_text(strip=True).lower() for c in _header_cells(first_row)]
        if "name" in headers and "description" in headers and "picture" in headers:
            table = candidate
            break

    if table is None:
        print("  WARNING: no matching table found", file=sys.stderr)
        return items

    rows = table.find_all("tr")
    header_row = rows[0]
    headers = [c.get_text(strip=True).lower() for c in _header_cells(header_row)]
    col_index = {h: i for i, h in enumerate(headers)}

    for row in rows[1:]:
        cells = row.find_all("td")
        if not cells:
            continue

        def cell_text(key):
            idx = col_index.get(key)
            if idx is None or idx >= len(cells):
                return ""
            return cells[idx].get_text(strip=True)

        def cell_link(key):
            idx = col_index.get(key)
            if idx is None or idx >= len(cells):
                return ""
            a = cells[idx].find("a")
            if a:
                href = a.get("href", "")
                if href and not href.startswith("http"):
                    href = "https://www.serebii.net" + href
                return href
            return ""

        def cell_img(key):
            idx = col_index.get(key, col_index.get("picture"))
            if idx is None or idx >= len(cells):
                return ""
            img = cells[idx].find("img")
            if img:
                src = img.get("src", "")
                if src and not src.startswith("http"):
                    src = "https://www.serebii.net" + src
                return src
            return ""

        name = cell_text("name")
        if not name:
            continue

        items.append({
            "name": name,
            "link": cell_link("name"),
            "picture": cell_img("picture"),
            "description": cell_text("description"),
            "category": cell_text("category"),
            "subcategories": [subcategory] if subcategory else [],
        })

    return items


def scrape(url):
    print(f"Fetching {url}", file=sys.stderr)
    resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    subcategory = extract_subcategory(soup)
    print(f"  subcategory: {subcategory}", file=sys.stderr)
    items = extract_items(soup, subcategory)
    print(f"  items found: {len(items)}", file=sys.stderr)
    return items


def main():
    urls = load_urls(SITEREF)
    items_by_name = {}
    for url in urls:
        try:
            for item in scrape(url):
                name = item["name"]
                if name in items_by_name:
                    existing = items_by_name[name]
                    for sub in item["subcategories"]:
                        if sub not in existing["subcategories"]:
                            existing["subcategories"].append(sub)
                else:
                    items_by_name[name] = item
        except Exception as e:
            print(f"  ERROR scraping {url}: {e}", file=sys.stderr)

    all_items = list(items_by_name.values())
    with open(OUTPUT, "w") as f:
        json.dump(all_items, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(all_items)} items to {OUTPUT}")


if __name__ == "__main__":
    main()
