import { redirect } from 'next/navigation'

export default function WorkspacePage({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/chat`)
}
