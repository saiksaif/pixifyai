import { useId } from '@mantine/hooks';

type GradientTuple = [string, string];
export function Badge({
  innerGradient,
  outerGradient,
  fill,
}: {
  innerGradient?: GradientTuple;
  outerGradient?: GradientTuple;
  fill?: string;
}) {
  fill ??= '#fff';
  innerGradient ??= ['#081692', '#1E043C'];
  outerGradient ??= ['#1284F7', '#0A20C9'];
  const uuid = useId();

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20.7 22.7">
      <g>
        <linearGradient
          id={uuid + '-inner'}
          gradientUnits="userSpaceOnUse"
          x1="10.156"
          y1="22.45"
          x2="10.156"
          y2="2.4614"
          gradientTransform="matrix(1 0 0 -1 0 24)"
        >
          <stop offset="0" style={{ stopColor: innerGradient[0] }} />
          <stop offset="1" style={{ stopColor: innerGradient[1] }} />
        </linearGradient>
        <linearGradient
          id={uuid + '-outer'}
          gradientUnits="userSpaceOnUse"
          x1="10.156"
          y1="22.45"
          x2="10.156"
          y2="2.45"
          gradientTransform="matrix(1 0 0 -1 0 24)"
        >
          <stop offset="0" style={{ stopColor: outerGradient[0] }} />
          <stop offset="1" style={{ stopColor: outerGradient[1] }} />
        </linearGradient>
        <path
          style={{ fill: `url(#${uuid}-inner)` }}
          d="M1.5,6.6v10l8.7,5l8.7-5v-10l-8.7-5L1.5,6.6z"
        />
        <path
          style={{ fill: `url(#${uuid}-outer)` }}
          d="M10.2,4.7l5.9,3.4V15l-5.9,3.4L4.2,15V8.1
L10.2,4.7 M10.2,1.6l-8.7,5v10l8.7,5l8.7-5v-10C18.8,6.6,10.2,1.6,10.2,1.6z"
        />
        <path
          style={{ fill: fill ?? '#fff' }}
          d="M11.8,12.4l-1.7,1l-1.7-1v-1.9l1.7-1l1.7,1h2.1V9.3l-3.8-2.2L6.4,9.3v4.3l3.8,2.2l3.8-2.2v-1.2H11.8z"
        />
      </g>
    </svg>
  );
}
