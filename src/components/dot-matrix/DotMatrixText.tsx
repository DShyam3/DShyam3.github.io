import './DotMatrixText.css';

type Size = 'xs' | 'sm' | 'md' | 'lg';

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
  return (
    <span
      className={`dot-matrix-text dot-matrix-text-${size} ${className}`}
      style={{
        whiteSpace: wrap ? 'normal' : 'nowrap',
      }}
    >
      {text}
    </span>
  );
};

