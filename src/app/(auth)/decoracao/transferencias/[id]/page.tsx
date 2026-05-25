import { TransferenciaDetail } from '../../_components/transferencia-detail'

export default async function TransferenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TransferenciaDetail id={id} />
}
