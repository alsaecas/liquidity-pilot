interface TransactionStageProps {
  current: number;
  labels: readonly string[];
}

export function TransactionStage({ current, labels }: TransactionStageProps) {
  return (
    <ol aria-label="Transaction progress" className="transaction-stages">
      {labels.map((label, index) => (
        <li className={index <= current ? "stage stage-active" : "stage"} key={label}>
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
