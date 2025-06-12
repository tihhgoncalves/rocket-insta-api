import { PostingLocation, PostingStoryOptions, PostingUsertags } from './posting.options';

export interface PostingPhotoOptions {
  file: Buffer;
  caption?: string;
  usertags?: PostingUsertags;
  location?: PostingLocation;
  hideLikeAndViewCounts?: boolean;
}

export interface PostingStoryPhotoOptions extends PostingStoryOptions {
  file: Buffer;
}
