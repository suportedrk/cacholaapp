import { ItemEditor } from '../../_components/item-editor'

export const metadata = { title: 'Novo item — Decoração' }

export default function NovoItemPage() {
  return <ItemEditor mode="create" />
}
