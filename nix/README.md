# Installing using Nix

Nix users can install Hunk from source instead of using npm.

## Install from a flake

1. Add Hunk to your nix flake inputs like such:

```nix
{
    inputs = {
        hunk = {
          url = "github:modem-dev/hunk";
          inputs.nixpkgs.follows = "nixpkgs";
        };
    }
}
```

2. Use in NixOS `environment.systemPackages`:

```nix
{
  environment.systemPackages = [
    inputs.hunk.packages.${pkgs.stdenv.hostPlatform.system}.default
  ];
}
```

Or in Home Manager `home.packages`:

```nix
{
  home.packages = [
    inputs.hunk.packages.${pkgs.stdenv.hostPlatform.system}.default
  ];
}
```

## Home Manager

Hunk provides a Home Manager module to manage both the package and its configuration.

1. Add the module to your Home Manager configuration:

```nix
{
  imports = [
    inputs.hunk.homeManagerModules.default
  ];

  programs.hunk = {
    enable = true;
    enableGitIntegration = true; # Optional: set hunk as default git pager
    settings = {
      theme = "graphite";
      mode = "split";
      line_numbers = true;
    };
  };
}
```

`enableGitIntegration` writes to Home Manager's Git configuration, so it requires Home Manager's Git module to be enabled with `programs.git.enable = true;`.

## Updating Hunk

Flake users update Hunk by updating their own pinned `flake.lock` input:

```bash
nix flake lock --update-input hunk
```

## Building using Nix

Simply run `nix build .#packages.{YOUR_SYSTEM}.default` where YOUR_SYSTEM is one of `x86_64-linux`, `x86_64-darwin`, `aarch64-linux` or `aarch64-darwin`. The resulting
Hunk binary will be `./result/bin/hunk`.

## Maintainer dependency updates

When JavaScript or Bun dependencies change, regenerate the Nix dependency lockfile and commit it with the dependency change:

```bash
bun run nix:update-lock
```
