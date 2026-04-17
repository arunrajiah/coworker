'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { api, type Skill } from '@/lib/api'

export default function SettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [skills, setSkills] = useState<Skill[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', prompt: '', triggerPhrase: '' })

  useEffect(() => {
    api.skills.list(slug).then(setSkills)
  }, [slug])

  async function handleCreateSkill(e: React.FormEvent) {
    e.preventDefault()
    const skill = await api.skills.create(slug, {
      ...form,
      tools: [],
      isActive: true,
    })
    setSkills((prev) => [...prev, skill])
    setCreating(false)
    setForm({ name: '', description: '', prompt: '', triggerPhrase: '' })
  }

  async function handleToggle(skill: Skill) {
    const updated = await api.skills.update(slug, skill.id, { isActive: !skill.isActive })
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)))
  }

  async function handleDelete(id: string) {
    await api.skills.delete(slug, id)
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage skills and workspace configuration</p>
        </div>

        {/* Skills */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Skills</h2>
              <p className="text-sm text-muted-foreground">
                Skills extend your coworker&apos;s behavior with custom prompts
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add skill
            </button>
          </div>

          {creating && (
            <form onSubmit={handleCreateSkill} className="border border-border rounded-lg p-4 space-y-3">
              <input
                required
                placeholder="Skill name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                placeholder="Trigger phrase (e.g. /report)"
                value={form.triggerPhrase}
                onChange={(e) => setForm((f) => ({ ...f, triggerPhrase: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                required
                rows={4}
                placeholder="System prompt addition for this skill..."
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {skills.length === 0 && !creating ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No skills yet</p>
            ) : (
              skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{skill.name}</p>
                      {skill.triggerPhrase && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                          {skill.triggerPhrase}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{skill.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleToggle(skill)} className="text-muted-foreground hover:text-foreground">
                      {skill.isActive ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button onClick={() => handleDelete(skill.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
