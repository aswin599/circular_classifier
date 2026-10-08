import { useState } from 'react';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../hooks/useApi';
import type { Category } from '../../types';

interface CategoryFormData {
  name: string;
  description: string;
  keywords: string;
  color: string;
}

const emptyForm: CategoryFormData = {
  name: '',
  description: '',
  keywords: '',
  color: '#3B82F6',
};

export default function CategoryManager() {
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>(emptyForm);

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description || '',
      keywords: category.keywords.join(', '),
      color: category.color,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const keywords = form.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const data = {
      name: form.name,
      description: form.description || undefined,
      keywords,
      color: form.color,
    };

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ id: editingCategory.id, data });
        toast.success('Category updated');
      } else {
        await createCategory.mutateAsync(data);
        toast.success('Category created');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? This cannot be undone.`)) return;

    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success('Category deleted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete category';
      toast.error(message);
    }
  };

  const inputClasses =
    'w-full px-3 py-2 border border-brand-200 rounded-lg bg-white text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Category Management</h1>
          <p className="mt-1 text-sm text-brand-500">
            Manage classification categories and their keywords
          </p>
        </div>
        <Button onClick={openCreateModal}>+ Add Category</Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-brand-400">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <h3 className="font-semibold text-brand-900">
                    {category.name}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(category)}
                    className="text-brand-300 hover:text-brand-600 p-1"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className="text-brand-300 hover:text-red-500 p-1"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {category.description && (
                <p className="mt-2 text-sm text-brand-500">
                  {category.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {category.keywords.slice(0, 6).map((keyword) => (
                  <Badge key={keyword} color={category.color} size="sm">
                    {keyword}
                  </Badge>
                ))}
                {category.keywords.length > 6 && (
                  <Badge color="#6B7280" size="sm">
                    +{category.keywords.length - 6} more
                  </Badge>
                )}
              </div>

              {category._count && (
                <p className="mt-3 text-xs text-brand-400">
                  {category._count.circulars} circulars
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClasses}
              placeholder="e.g., Examination"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${inputClasses} resize-none`}
              rows={2}
              placeholder="Brief description of this category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1">
              Keywords (comma-separated)
            </label>
            <textarea
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              className={`${inputClasses} resize-none`}
              rows={3}
              placeholder="exam, test, schedule, result, final"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm text-brand-500">{form.color}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createCategory.isPending || updateCategory.isPending}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
