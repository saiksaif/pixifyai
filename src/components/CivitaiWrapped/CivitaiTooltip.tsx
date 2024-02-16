import { Text, Tooltip, TooltipProps } from '@mantine/core';

const variants: Record<string, Partial<TooltipProps>> = {
  smallRounded: {
    offset: 5,
    radius: 'lg',
    transitionDuration: 500,
    openDelay: 100,
    closeDelay: 250,
    styles: {
      tooltip: {
        maxWidth: 200,
        backgroundColor: 'rgba(0,0,0,.5)',
        padding: '1px 10px 2px',
        zIndex: 9,
      },
    },
    multiline: true,
  },
  roundedOpaque: {
    // offset: 5,
    radius: 'lg',
    transitionDuration: 200,
    styles: {
      tooltip: {
        maxWidth: 500,
        backgroundColor: 'rgba(0,0,0,1)',
        zIndex: 9,
      },
    },
    multiline: true,
  },
};

export function CivitaiTooltip({ variant, ...props }: CivitaiTooltipProps) {
  const variantProps = variant ? variants[variant] : {};
  if (variant === 'smallRounded')
    props.label = (
      <Text size="xs" weight={500}>
        {props.label}
      </Text>
    );
  return (
    <Tooltip {...variantProps} {...props}>
      {props.children}
    </Tooltip>
  );
}

export type CivitaiTooltipProps = { variant?: keyof typeof variants } & TooltipProps;
