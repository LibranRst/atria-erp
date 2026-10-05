export class RedirectControl extends Error {
  constructor(
    readonly location: string,
    readonly permanent = false,
  ) {
    super("API_REDIRECT");
    this.name = "RedirectControl";
  }
}

export class NotFoundControl extends Error {
  constructor() {
    super("API_NOT_FOUND");
    this.name = "NotFoundControl";
  }
}

export function redirect(location: string): never {
  throw new RedirectControl(location);
}

export function permanentRedirect(location: string): never {
  throw new RedirectControl(location, true);
}

export function notFound(): never {
  throw new NotFoundControl();
}
