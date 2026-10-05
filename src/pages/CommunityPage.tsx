import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { listCommunityMembers } from '../services/communityService';
import { useCommunityQuery } from '../services/useCommunityQuery';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';

export function CommunityPage({
  areas,
  refreshKey,
  onOpenMember,
}: {
  areas: string[];
  refreshKey: number;
  onOpenMember: (key: string) => void;
}) {
  const [filters, setFilters] = useState({ search: '', area: '', interest: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(filters);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);
  const read = useCallback(
    () => listCommunityMembers(query.search, query.area, query.interest, page),
    [query, page],
  );
  const { data, loading, error, retry } = useCommunityQuery(read, refreshKey);
  return (
    <div className="page-stack community-page">
      <header className="community-heading">
        <h1>Comunidade</h1>
        <p>Conheça pessoas e encontre habilidades complementares para sua squad.</p>
      </header>
      <div className="community-filters">
        <label className="field">
          <span>Buscar pessoa</span>
          <span className="community-search">
            <Search size={17} />
            <input
              type="search"
              maxLength={120}
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Nome"
            />
          </span>
        </label>
        <label className="field">
          <span>Área</span>
          <select
            value={filters.area}
            onChange={(event) => setFilters({ ...filters, area: event.target.value })}
          >
            <option value="">Todas as áreas</option>
            {areas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Quero praticar</span>
          <input
            type="search"
            maxLength={120}
            placeholder="APIs, React..."
            value={filters.interest}
            onChange={(event) => setFilters({ ...filters, interest: event.target.value })}
          />
        </label>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={retry}>Tentar novamente</Button>
        </div>
      )}
      {loading && <p role="status">Carregando membros...</p>}
      <div className="community-list" aria-busy={loading}>
        {data?.members.map((member) => (
          <article className="community-person" key={member.memberKey}>
            <Avatar name={member.name} src={member.avatarUrl} />
            <div>
              <h2>{member.name}</h2>
              <p>{member.primaryRole}</p>
              {member.bio && <p className="member-summary">{member.bio}</p>}
              <p className="muted-copy">
                {member.areas.concat(member.technologies).slice(0, 6).join(' · ')}
              </p>
            </div>
            <Button
              aria-label={`Ver perfil de ${member.name}`}
              onClick={() => onOpenMember(member.memberKey)}
            >
              Ver perfil
            </Button>
          </article>
        ))}
        {!loading && data?.members.length === 0 && (
          <p>Nenhum membro encontrado com estes filtros.</p>
        )}
      </div>
      <nav className="community-pagination" aria-label="Paginação de membros">
        <Button
          size="icon"
          icon={<ChevronLeft size={18} />}
          title="Página anterior"
          aria-label="Página anterior"
          disabled={loading || page === 0}
          onClick={() => setPage(page - 1)}
        />
        <span>Página {page + 1}</span>
        <Button
          size="icon"
          icon={<ChevronRight size={18} />}
          title="Próxima página"
          aria-label="Próxima página"
          disabled={loading || !data?.hasMore}
          onClick={() => setPage(page + 1)}
        />
      </nav>
    </div>
  );
}
