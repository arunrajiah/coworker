'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Skill } from '@/lib/api'

export default function SkillsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', prompt: '', triggerPhrase: '' })

  useEffect(() => {
    api.skills.list(slug).then((s) => { setSkills(s); setLoading(false) })
  }, [slug])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const skill = await api.skills.create(slug, { ...form, tools: [], isActive: true })
      setSkills((prev) => [...prev, skill])
      setCreating(false)
      setForm({ name: '', description: '', prompt: '', triggerPhrase: '' })
      toast.success('Skill created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create skill')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(skill: Skill) {
    try {
      const updated = await api.skills.update(slug, skill.id, { isActive: !skill.isActive })
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update skill')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.skills.delete(slug, id)
      setSkills((prev) => prev.filter((s) => s.id !== id))
      toast.success('Skill deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete skill')
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Skills</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Custom instructions that extend your coworker&apos;s behaviour. Trigger a skill by phrase (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">/report</code>) or let it always be active.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add skill
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <form onSubmit={handleCreate} className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Skill name</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Daily standup"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Trigger phrase (optional)</label>
                <input
                  placeholder="e.g. /standup"
                  value={form.triggerPhrase}
                  onChange={(e) => setForm((f) => ({ ...f, triggerPhrase: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Instructions</label>
              <textarea
                required
                rows={4}
                placeholder="What should the coworker do when this skill is triggered? Be specific about format, tone, and any data it should include..."
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save skill
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setForm({ name: '', description: '', prompt: '', triggerPhrase: '' }) }}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Skills list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading skills...
          </div>
        ) : skills.length === 0 && !creating ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">No skills yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Skills let you give your coworker a specific persona, format, or set of instructions for particular tasks.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create your first skill
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={skill.id} className="flex items-start gap-3 p-4 rounded-xl border border-border hover:bg-accent/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{skill.name}</p>
                    {skill.triggerPhrase && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono">
                        {skill.triggerPhrase}
                      </span>
                    )}
                    {!skill.isActive && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{skill.prompt}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <button
                    onClick={() => handleToggle(skill)}
                    title={skill.isActive ? 'Disable skill' : 'Enable skill'}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {skill.isActive ? (
                      <ToggleRight className="h-5 w-5 text-primary" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    title="Delete skill"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
