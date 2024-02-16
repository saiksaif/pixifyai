import { Tabs, TabsProps, createStyles } from '@mantine/core';
import { containerQuery } from '~/utils/mantine-css-helpers';

const useStyles = createStyles((theme, _params, getRef) => {
  const tabLabelRef = getRef('tabLabel');

  return {
    tabLabel: {
      ref: tabLabelRef,
    },

    tab: {
      ...theme.fn.focusStyles(),
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
      color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.colors.gray[9],
      border: `1px solid ${
        theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[4]
      }`,
      padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
      cursor: 'pointer',
      fontSize: theme.fontSizes.sm,
      display: 'flex',
      alignItems: 'center',

      '&:disabled': {
        opacity: 0.5,
        cursor: 'not-allowed',
      },

      '&:hover:not([data-active])': {
        backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0],
      },

      '&:not(:first-of-type)': {
        borderLeft: 0,
      },

      '&:first-of-type': {
        borderTopLeftRadius: theme.radius.sm,
        borderBottomLeftRadius: theme.radius.sm,
      },

      '&:last-of-type': {
        borderTopRightRadius: theme.radius.sm,
        borderBottomRightRadius: theme.radius.sm,
      },

      '&[data-active]': {
        backgroundColor: theme.colors.blue[7],
        borderColor: theme.colors.blue[7],
        color: theme.white,
      },

      [containerQuery.smallerThan('sm')]: {
        padding: `${theme.spacing.xs}px ${theme.spacing.xs}px`,

        [`&:not([data-active="true"]) > .${tabLabelRef}`]: {
          display: 'none',
        },
      },
    },

    tabIcon: {
      marginRight: theme.spacing.xs,
      display: 'flex',
      alignItems: 'center',

      [containerQuery.smallerThan('sm')]: {
        marginRight: theme.spacing.xs * 0.4, // 4px
      },
    },

    tabsList: {
      display: 'flex',
    },
  };
});

export function CivitaiTabs(props: TabsProps) {
  const { classes } = useStyles();

  return <Tabs unstyled classNames={classes} {...props} />;
}
