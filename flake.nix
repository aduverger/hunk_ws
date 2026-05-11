{
  description = "Dev Flake for Modem-dev's Hunk";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix.url = "github:nix-community/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
  };
  nixConfig = {
    extra-trusted-substituters = [
      "https://nix-community.cachix.org"
    ];
    extra-trusted-public-keys = [
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };
  outputs = {
    self,
    nixpkgs,
    bun2nix,
    ...
  }: let
    lib = nixpkgs.lib;
    supportedSystems = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    forAllSystems = lib.genAttrs supportedSystems;
  in {
    packages = forAllSystems (
      system: let
        pkgs = import nixpkgs {
          inherit system;
        };
      in {
        default = pkgs.callPackage ./nix/package.nix {
          bun2nix = bun2nix.packages.${system}.default;
        };
      }
    );

    devShells = forAllSystems (
      system: let
        pkgs = import nixpkgs {
          inherit system;
        };
      in {
        default = pkgs.callPackage ./nix/devShell.nix {};
      }
    );

    homeManagerModules = {
      hunk = import ./nix/home-manager.nix;
      default = {pkgs, ...}: {
        imports = [self.homeManagerModules.hunk];
        programs.hunk.package = lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      };
    };
  };
}
