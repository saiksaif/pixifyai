import { createStore, useStore } from 'zustand';
import { createContext, useContext, useRef, useEffect, SetStateAction } from 'react';
import { immer } from 'zustand/middleware/immer';
import { PostEditDetail, PostEditImage } from '~/server/controllers/post.controller';
import { devtools } from 'zustand/middleware';
import { isDefined } from '~/utils/type-guards';
import { trpc } from '~/utils/trpc';
import { useCFUploadStore } from '~/store/cf-upload.store';
import { PostImage } from '~/server/selectors/post.selector';
import { getDataFromFile } from '~/utils/metadata';
import { MediaType } from '@prisma/client';

//https://github.com/pmndrs/zustand/blob/main/docs/guides/initialize-state-with-props.md
export type ImageUpload = {
  uuid: string;
  url: string;
  name: string;
  meta?: any;
  type: MediaType;
  metadata: any;
  height: number;
  width: number;
  hash: string;
  index: number;
  status: 'blocked' | 'uploading';
  message?: string;
  mimeType: string;
  file: File;
};
export type ImageBlocked = {
  uuid: string;
  blockedFor?: string[];
  tags?: { type: string; name: string }[];
};
type ImageProps =
  | { discriminator: 'image'; data: PostEditImage }
  | { discriminator: 'upload'; data: ImageUpload }
  | { discriminator: 'blocked'; data: ImageBlocked };
type TagProps = { id?: number; name: string };
type EditPostProps = {
  objectUrls: string[];
  id: number;
  modelVersionId?: number;
  title?: string;
  detail?: string;
  nsfw: boolean;
  publishedAt?: Date;
  tags: TagProps[];
  images: ImageProps[];
  reorder: boolean;
  selectedImageId?: number;
  deleting: boolean;
};

interface EditPostState extends EditPostProps {
  setTitle: (title?: string) => void;
  setDetail: (detail?: string) => void;
  toggleNsfw: (value?: boolean) => void;
  setPublishedAt: (publishedAt: Date) => void;
  toggleReorder: (value?: boolean) => void;
  setTags: (dispatch: SetStateAction<TagProps[]>) => void;
  setImage: (id: number, updateFn: (images: PostEditImage) => PostEditImage) => void;
  setImages: (updateFn: (images: PostEditImage[]) => PostEditImage[]) => void;
  setSelectedImageId: (id?: number) => void;
  upload: (
    { postId, modelVersionId }: { postId: number; modelVersionId?: number },
    files: File[]
  ) => Promise<void>;
  /** usefull for removing files that were unable to finish uploading */
  removeFile: (uuid: string) => void;
  removeImage: (id: number) => void;
  /** used to clean up object urls */
  cleanup: () => void;
  reset: (post?: PostEditDetail) => void;
  setDeleting: (value: boolean) => void;
}

type EditPostStore = ReturnType<typeof createEditPostStore>;

const prepareImages = (images: PostEditImage[]) =>
  images.map((image): ImageProps => ({ discriminator: 'image', data: image }));

const processPost = (post?: PostEditDetail) => {
  return {
    id: post?.id ?? 0,
    title: post?.title ?? undefined,
    detail: post?.detail ?? undefined,
    nsfw: post?.nsfw ?? false,
    publishedAt: post?.publishedAt ?? undefined,
    tags: post?.tags ?? [],
    images: post?.images ? prepareImages(post.images) : [],
    modelVersionId: post?.modelVersionId ?? undefined,
  };
};

type HandleUploadProps = ImageUpload & { postId: number; modelVersionId?: number };

const createEditPostStore = ({
  post,
  handleUpload,
}: {
  post?: PostEditDetail;
  handleUpload: (
    props: HandleUploadProps,
    cb: (created: PostImage) => Promise<void>
  ) => Promise<void>;
}) => {
  return createStore<EditPostState>()(
    devtools(
      immer((set, get) => {
        const initialData = processPost(post);
        return {
          objectUrls: [],
          reorder: false,
          deleting: false,
          ...initialData,
          // methods
          setTitle: (title) =>
            set((state) => {
              state.title = title;
            }),
          setDetail: (detail) =>
            set((state) => {
              state.detail = detail;
            }),
          toggleNsfw: (value) =>
            set((state) => {
              state.nsfw = value ?? !state.nsfw;
            }),
          setPublishedAt: (publishedAt) =>
            set((state) => {
              state.publishedAt = publishedAt;
            }),
          toggleReorder: (value) =>
            set((state) => {
              state.reorder = value ?? !state.reorder;
            }),
          setTags: (dispatch) =>
            set((state) => {
              state.tags = typeof dispatch === 'function' ? dispatch(state.tags) : dispatch;
            }),
          setImage: (id, updateFn) =>
            set((state) => {
              const index = state.images.findIndex(
                (x) => x.discriminator === 'image' && x.data.id === id
              );
              if (index > -1)
                state.images[index].data = updateFn(state.images[index].data as PostEditImage);
            }),
          setImages: (updateFn) =>
            set((state) => {
              // only allow calling setImages if uploads are finished
              if (state.images.every((x) => x.discriminator === 'image')) {
                const images = state.images.map(({ data }) => data as PostEditImage);
                state.images = prepareImages(updateFn(images));
              }
            }),
          setSelectedImageId: (id) =>
            set((state) => {
              state.selectedImageId = id;
            }),
          upload: async ({ postId, modelVersionId }, files) => {
            set((state) => {
              state.id = postId;
              state.modelVersionId = modelVersionId;
            });
            const images = get().images;
            const toUpload = (
              await Promise.all(
                files.map(async (file, i) => {
                  const data = await getDataFromFile(file);
                  if (!data) return null;

                  return {
                    ...data,
                    index: images.length + i,
                  } as ImageUpload;
                })
              )
            ).filter(isDefined);
            set((state) => {
              state.objectUrls = [...state.objectUrls, ...toUpload.map((x) => x.url)];
              state.images = state.images.concat(
                toUpload.map((data) => ({ discriminator: 'upload', data }))
              );
            });
            await Promise.all(
              toUpload
                // do not upload images that have been rejected due to image prompt keywords
                .filter((x) => x.status === 'uploading')
                .map(async (data) => {
                  await handleUpload({ postId, modelVersionId, ...data }, async (created) => {
                    if (!created) return;
                    set((state) => {
                      const index = state.images.findIndex(
                        (x) => x.discriminator === 'upload' && x.data.uuid === data.uuid
                      );
                      if (index === -1) throw new Error('index out of bounds');
                      state.images[index] = {
                        discriminator: 'image',
                        data: { ...created, previewUrl: data.url },
                      };
                    });
                  });
                })
            );
          },
          removeFile: (uuid) =>
            set((state) => {
              const index = state.images.findIndex(
                (x) =>
                  (x.discriminator === 'upload' || x.discriminator === 'blocked') &&
                  x.data.uuid === uuid
              );
              if (index === -1) throw new Error('index out of bounds');
              state.images.splice(index, 1);
            }),
          removeImage: (id) =>
            set((state) => {
              const index = state.images.findIndex(
                (x) => x.discriminator === 'image' && x.data.id === id
              );
              if (index === -1) throw new Error('index out of bounds');
              state.images.splice(index, 1);
            }),
          cleanup: () => {
            const objectUrls = get().objectUrls;
            for (const url of objectUrls) {
              URL.revokeObjectURL(url);
            }
          },
          reset: (post) => {
            const storeId = get().id;
            if (storeId === post?.id) return;
            get().cleanup();
            set((state) => {
              const data = processPost(post);
              state.id = data.id;
              state.title = data.title;
              state.nsfw = data.nsfw;
              state.tags = data.tags;
              state.images = data.images;
              state.objectUrls = [];
              state.modelVersionId = data.modelVersionId;
            });
          },
          setDeleting: (value) =>
            set((state) => {
              state.deleting = value;
            }),
        };
      })
    )
  );
};

const EditPostContext = createContext<EditPostStore | null>(null);
export const EditPostProvider = ({
  children,
  post,
}: {
  children: React.ReactNode;
  post?: PostEditDetail;
}) => {
  const { mutateAsync } = trpc.post.addImage.useMutation();

  const upload = useCFUploadStore((state) => state.upload);

  const handleUpload = async (
    { postId, modelVersionId, file, ...data }: HandleUploadProps,
    cb: (created: PostImage) => Promise<void>
  ) => {
    await upload(file, async (result) => {
      if (!result.success) return;
      const { id } = result.data;
      mutateAsync({ ...data, url: id, postId, modelVersionId }).then((data) =>
        cb(data as PostImage)
      );
    });
  };

  const storeRef = useRef<EditPostStore>();
  if (!storeRef.current) {
    storeRef.current = createEditPostStore({ post, handleUpload });
  }

  useEffect(() => {
    return () => {
      storeRef.current?.getState().cleanup(); // removes object urls
    };
  }, []); //eslint-disable-line

  useEffect(() => {
    storeRef.current?.getState().reset(post);
  }, [post]); //eslint-disable-line

  return <EditPostContext.Provider value={storeRef.current}>{children}</EditPostContext.Provider>;
};

export function useEditPostContext<T>(selector: (state: EditPostState) => T) {
  const store = useContext(EditPostContext);
  if (!store) throw new Error('Missing EditPostContext.Provider in the tree');
  return useStore(store, selector);
}
