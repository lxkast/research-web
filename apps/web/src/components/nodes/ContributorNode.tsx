export function ContributorNode({ data }: { data: { id: string; name: string } }) {
  return (
    <div className="node-card node-contributor">
      <div className="node-title">{data.name}</div>
    </div>
  )
}
