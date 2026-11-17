import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Category } from '../types.ts';
import { adminFetch } from '../utils/adminAuth.ts';

interface CategoryManagerProps {
  categories: Category[];
  onRefresh: () => Promise<void>;
}

export function CategoryManager({ categories, onRefresh }: CategoryManagerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Indique o nome da nova categoria.');
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar categoria.');
      setName('');
      setDescription('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar categoria.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cat: Category) {
    setError(null);
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description);
  }

  async function saveEdit(id: string) {
    setError(null);
    if (!editName.trim()) {
      setError('O nome da categoria não pode ficar vazio.');
      return;
    }
    try {
      const res = await adminFetch(`/api/categories/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar categoria.');
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar categoria.');
    }
  }

  async function confirmDelete(cat: Category) {
    setError(null);
    const hasArticles = (cat.articleCount ?? 0) > 0;
    if (hasArticles && !reassignTargetId) {
      const fallback = categories.find((c) => c.id !== cat.id);
      setDeletingId(cat.id);
      setReassignTargetId(fallback?.id ?? '');
      return;
    }

    try {
      const query = hasArticles && reassignTargetId
        ? `?reassignTo=${encodeURIComponent(reassignTargetId)}`
        : '';
      const res = await adminFetch(`/api/categories/${encodeURIComponent(cat.id)}${query}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir categoria.');
      setDeletingId(null);
      setReassignTargetId('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir categoria.');
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleCreate}
        className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E6E1D6] dark:border-[#262932] pb-3">
          <h2 className="font-serif text-xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
            Nova Categoria Editorial
          </h2>
          <span className="font-mono text-xs text-[#635E56] dark:text-[#9B968C] tabular-nums">
            {categories.length} ativa(s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label htmlFor="cat-name" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
              Nome da categoria
            </label>
            <input
              id="cat-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lusofonia & Diáspora"
              className="w-full px-3.5 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
            />
          </div>

          <div className="md:col-span-6">
            <label htmlFor="cat-desc" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
              Descrição editorial
            </label>
            <input
              id="cat-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo dos temas cobertos nesta secção"
              className="w-full px-3.5 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'A criar...' : 'Adicionar'}</span>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-[#9A3412] dark:text-[#FB923C]">
            {error}
          </p>
        )}
      </form>

      <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E6E1D6] dark:border-[#262932] bg-[#F6F2EA] dark:bg-[#1D2027] text-xs font-semibold text-[#47433D] dark:text-[#C5BFB4]">
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4">Slug</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4 text-right">Artigos</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E1D6] dark:divide-[#262932] text-sm">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isDeletingWithReassign = deletingId === cat.id;
              const otherCategories = categories.filter((c) => c.id !== cat.id);

              return (
                <tr key={cat.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#1B1E25]">
                  <td className="py-3.5 px-4 font-medium text-[#171614] dark:text-[#F2EFE9] align-top">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-[#111318] border border-[#1E3A8A] dark:border-[#60A5FA] text-[#171614] dark:text-[#F2EFE9] focus:outline-none"
                      />
                    ) : (
                      cat.name
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-[#635E56] dark:text-[#9B968C] align-top">
                    /{cat.slug}
                  </td>
                  <td className="py-3.5 px-4 text-[#47433D] dark:text-[#A9A398] text-xs leading-relaxed align-top max-w-md">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#111318] border border-[#1E3A8A] dark:border-[#60A5FA] text-[#171614] dark:text-[#F2EFE9] focus:outline-none"
                      />
                    ) : (
                      cat.description || '—'
                    )}

                    {isDeletingWithReassign && (
                      <div className="mt-3 p-3 bg-[#FEF3C7] dark:bg-[#2B2111] border border-[#F59E0B] dark:border-[#B45309] text-[#78350F] dark:text-[#FCD34D] space-y-2">
                        <p className="font-medium">
                          Esta categoria tem {cat.articleCount} artigo(s). Escolha para qual categoria movê-los antes de excluir:
                        </p>
                        {otherCategories.length === 0 ? (
                          <p>Crie outra categoria antes de remover a única existente.</p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={reassignTargetId}
                              onChange={(e) => setReassignTargetId(e.target.value)}
                              className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9]"
                            >
                              {otherCategories.map((other) => (
                                <option key={other.id} value={other.id}>
                                  {other.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => confirmDelete(cat)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] cursor-pointer"
                            >
                              Mover e Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingId(null);
                                setReassignTargetId('');
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-[#171614] dark:text-[#F2EFE9] tabular-nums align-top">
                    {cat.articleCount ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-right align-top">
                    <div className="inline-flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(cat.id)}
                            title="Guardar"
                            className="p-1.5 text-[#15803D] dark:text-[#4ADE80] hover:bg-[#DCFCE7] dark:hover:bg-[#16291D] cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title="Cancelar"
                            className="p-1.5 text-[#635E56] dark:text-[#9B968C] hover:bg-[#EBE6DF] dark:hover:bg-[#262932] cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            title="Editar categoria"
                            className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] hover:bg-[#EBE6DF] dark:hover:bg-[#262932] cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(cat)}
                            title="Excluir categoria"
                            className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#9A3412] dark:hover:text-[#FB923C] hover:bg-[#FEE2E2] dark:hover:bg-[#2D1816] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
