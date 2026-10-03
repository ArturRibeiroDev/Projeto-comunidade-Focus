import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { ProjectDisplay } from '../../types';
import { searchProjects } from '../../utils/projectFilters';

export function ProjectSearch({
  query,
  projects,
  onQueryChange,
  onSelect,
  onViewAll,
}: {
  query: string;
  projects: ProjectDisplay[];
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onViewAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const matches = searchProjects(projects, query);
  const visible = matches.slice(0, 6);
  const showAll = matches.length > 6 || Boolean(query.trim());
  const optionCount = visible.length + Number(showAll);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(`[data-search-index="${active}"]`);
    if (!option || !listRef.current) return;
    if (option.offsetTop < listRef.current.scrollTop) listRef.current.scrollTop = option.offsetTop;
    if (
      option.offsetTop + option.offsetHeight >
      listRef.current.scrollTop + listRef.current.clientHeight
    )
      listRef.current.scrollTop =
        option.offsetTop + option.offsetHeight - listRef.current.clientHeight;
  }, [active]);

  const select = (id: string) => {
    setOpen(false);
    setActive(-1);
    onSelect(id);
  };
  const viewAll = () => {
    setOpen(false);
    setActive(-1);
    onViewAll();
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && optionCount) {
      event.preventDefault();
      setOpen(true);
      setActive((current) =>
        event.key === 'ArrowDown'
          ? (current + 1) % optionCount
          : current <= 0
            ? optionCount - 1
            : current - 1,
      );
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (active >= 0 && active < visible.length) select(visible[active].id);
      else if (active === visible.length && showAll) viewAll();
      else if (visible.length) select(visible[0].id);
      else if (query.trim()) viewAll();
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="global-search-wrap" ref={wrapperRef}>
      <label className="global-search" htmlFor="global-project-search">
        <Search aria-hidden="true" size={16} />
        <span className="sr-only">Buscar projetos</span>
        <input
          aria-activedescendant={open && active >= 0 ? `${listId}-option-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          id="global-project-search"
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keyDown}
          placeholder="Buscar projetos..."
          role="combobox"
          value={query}
        />
      </label>
      {open && (
        <div className="global-search-dropdown" id={listId} ref={listRef} role="listbox">
          {visible.map((project, index) => (
            <button
              aria-selected={active === index}
              className="search-result"
              data-search-index={index}
              id={`${listId}-option-${index}`}
              key={`${project.kind}-${project.id}`}
              onClick={() => select(project.id)}
              role="option"
              type="button"
            >
              <strong>{project.name}</strong>
              <small>
                {project.kind === 'template'
                  ? 'Focus Idea'
                  : `Projeto · ${project.members.length}/${project.memberLimit} membros`}
              </small>
            </button>
          ))}
          {visible.length === 0 && <p className="search-empty">Nenhum projeto encontrado.</p>}
          {showAll && (
            <button
              aria-selected={active === visible.length}
              className="search-view-all"
              data-search-index={visible.length}
              id={`${listId}-option-${visible.length}`}
              onClick={viewAll}
              role="option"
              type="button"
            >
              Ver todos os resultados
            </button>
          )}
        </div>
      )}
    </div>
  );
}
