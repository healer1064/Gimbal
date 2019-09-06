import env from '@modus/gimbal-core/lib/utils/env';
import { CIMode } from '@/typings/ci';
import { VCS as VCSTypes } from '@/typings/vcs';
import GitHub from '@/vcs/GitHub';

export default class GitHubActions {
  private $vcs?: VCSTypes;

  public static is(): boolean {
    // this is in the action Dockerfile in this repo
    // there wasn't any true/false envs to use to target
    // actions specifically
    return env('GITHUB_ACTIONS_CI', false) as boolean;
  }

  public get mode(): CIMode {
    return 'commit';
  }

  public get name(): string {
    return this.constructor.name;
  }

  public get owner(): string {
    return env('GITHUB_ACTOR');
  }

  public get pr(): number | void {
    return undefined;
  }

  public get repo(): string {
    return env('GITHUB_REPOSITORY');
  }

  public get sha(): string {
    return env('GITHUB_SHA') as string;
  }

  public get vcs(): GitHub | void {
    if (this.$vcs) {
      return this.$vcs;
    }

    this.$vcs = new GitHub();

    this.$vcs.ci = this;

    return this.$vcs;
  }
}
