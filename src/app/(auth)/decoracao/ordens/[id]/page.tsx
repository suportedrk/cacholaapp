import { OSEditor } from '../../_components/os-editor'

export default async function EditarOrdemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <OSEditor mode="edit" osId={id} />
}
