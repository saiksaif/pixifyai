import { ModelWizard } from '~/components/Resource/Wizard/ModelWizard';
import { createServerSideProps } from '~/server/utils/server-side-helpers';

export const getServerSideProps = createServerSideProps({
  useSession: true,
  useSSG: true,
  resolver: async ({ session, ssg }) => {
    if (!session) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    if (session.user?.bannedAt)
      return {
        redirect: { destination: '/', permanent: false },
      };

    if (ssg) {
      await ssg.model.getMyDraftModels.prefetchInfinite({});
    }

    return { props: { session } };
  },
});

export default function ModelNew() {
  return <ModelWizard />;
}
