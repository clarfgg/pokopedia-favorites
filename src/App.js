import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import rawItems from './assets/items.json';
import './App.css';
import imgDecoration from './assets/decoration.png';
import imgRelaxation from './assets/relaxation.png';
import imgToy from './assets/toy.png';

const items = rawItems.map((item) => ({
  ...item,
  _nameLower: item.name.toLowerCase(),
  _descLower: item.description.toLowerCase(),
  _catLower: item.category.toLowerCase(),
  _subsLower: item.subcategories.map((s) => s.toLowerCase()),
  _subsJoined: item.subcategories.join(', '),
}));

const CATEGORY_IMAGES = {
  decoration: imgDecoration,
  relaxation: imgRelaxation,
  toy: imgToy,
};

const PAGE_SIZE = 50;

function useVirtualScroll(filteredLength) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef(null);

  const attachLoader = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((n) => Math.min(n + PAGE_SIZE, filteredLength));
      }
    }, { threshold: 0.1 });
    observerRef.current.observe(node);
  }, [filteredLength]);

  return { visibleCount, setVisibleCount, attachLoader };
}

function descriptionMatches(item, terms) {
  if (!terms.length) return false;
  return terms.some((term) => term.length > 3 && item._descLower.includes(term));
}

const ItemRow = memo(function ItemRow({ item, terms }) {
  const catImg = CATEGORY_IMAGES[item._catLower];
  const descMatch = descriptionMatches(item, terms);
  const [open, setOpen] = useState(descMatch);

  useEffect(() => {
    if (descMatch) setOpen(true);
  }, [descMatch]);

  return (
    <tr>
      <td className="col-name">
        <div className="name-cell">
          {item.picture && <img src={item.picture} alt={item.name} className="item-thumb" />}
          <span>{item.name}</span>
        </div>
      </td>
      <td className="col-description">{item.description}</td>
      <td className="col-category">
        {catImg ? <img src={catImg} alt={item.category} className="category-icon" /> : null}
      </td>
      <td className="col-subcategories">{item._subsJoined}</td>
      <td className="col-link">
        <a href={item.link} target="_blank" rel="noreferrer">View</a>
      </td>
      <td className="col-desc-accordion">
        <button
          className={`accordion-toggle ${open ? 'open' : ''} ${descMatch ? 'highlight' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          Description {open ? '▲' : '▼'}
        </button>
        {open && <p className="accordion-body">{item.description}</p>}
      </td>
    </tr>
  );
});

const SORTABLE = ['name', 'category'];

function SortableHeader({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th className="sortable" onClick={() => onSort(col)}>
      {label}
      <span className="sort-indicator">
        {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
      </span>
    </th>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let result = terms.length
      ? items.filter((item) =>
          terms.every((term) =>
            item._nameLower.includes(term) ||
            item._descLower.includes(term) ||
            item._catLower.includes(term) ||
            item._subsLower.some((s) => s.includes(term))
          )
        )
      : [...items];

    if (sortCol) {
      result = [...result].sort((a, b) => {
        const cmp = a[sortCol].localeCompare(b[sortCol]);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [terms, sortCol, sortDir]);

  const { visibleCount, setVisibleCount, attachLoader } = useVirtualScroll(filtered.length);

  const handleSearch = (e) => {
    setQuery(e.target.value);
    setVisibleCount(PAGE_SIZE);
  };

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pokopedia Favorites</h1>
        <input
          className="search"
          type="search"
          placeholder="Search name, description, category, subcategory…"
          value={query}
          onChange={handleSearch}
        />
        <span className="result-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {SORTABLE.includes('name')
                ? <SortableHeader col="name" label="Name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                : <th>Name</th>}
              <th>Description</th>
              {SORTABLE.includes('category')
                ? <SortableHeader col="category" label="Category" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                : <th>Category</th>}
              <th>Subcategories</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <ItemRow key={item.name} item={item} terms={terms} />
            ))}
          </tbody>
        </table>

        {visibleCount < filtered.length && (
          <div ref={attachLoader} className="loader-sentinel">
            Loading more…
          </div>
        )}

        {filtered.length === 0 && (
          <p className="no-results">No items match "{query}".</p>
        )}
      </div>

      <footer className="app-footer">
        Data sourced from <a href="https://serebii.net/" target="_blank" rel="noreferrer">Serebii</a>
      </footer>
    </div>
  );
}
