import './DotMatrixText.css';

type Size = 'ui' | 'xs' | 'sm' | 'md' | 'lg';

interface DotMatrixTextProps {
  text: string;
  size?: Size;
  className?: string;
  wrap?: boolean;
}

export const DotMatrixText = ({
  text,
  size = 'md',
  className = '',
  wrap = true,
}: DotMatrixTextProps) => {
  const parts = text.split(/(\d+)/);

  return (
    <span
      className={`dot-matrix-text dot-matrix-text-${size} ${className}`}
      style={{
        whiteSpace: wrap ? 'normal' : 'nowrap',
      }}
    >
      <span>
        {parts.map((part, index) =>
          /^\d+$/.test(part) ? (
            <span className="dot-matrix-number" key={index}>{part}</span>
          ) : part,
        )}
      </span>
    </span>
  );
};

