export function PageHeader({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail?: string;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="label-caps">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {detail ? <p className="detail">{detail}</p> : null}
    </header>
  );
}
