import { ItemEditor } from '../../_components/item-editor'

export const metadata = { title: 'Editar item — Decoração' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditItemPage({ params }: Props) {
  const { id } = await params
  return <ItemEditor mode="edit" itemId={id} />
}
