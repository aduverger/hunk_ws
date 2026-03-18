import { describe, expect, mock, test } from "bun:test";
import { shutdownSession } from "../src/core/shutdown";

describe("shutdownSession", () => {
  test("unmounts, destroys, clears the terminal, and exits", () => {
    const events: string[] = [];
    const exit = mock((code: number) => {
      events.push(`exit:${code}`);
    });
    const stdout = {
      isTTY: true,
      write: (chunk: string) => {
        events.push(`write:${JSON.stringify(chunk)}`);
      },
    };

    shutdownSession({
      root: {
        unmount: () => events.push("unmount"),
      },
      renderer: {
        destroy: () => events.push("destroy"),
      },
      stdout,
      exit,
    });

    expect(events).toEqual(["unmount", "destroy", 'write:"\\u001b[2J\\u001b[H"', "exit:0"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test("skips the clear sequence when stdout is not a tty", () => {
    const events: string[] = [];

    shutdownSession({
      root: {
        unmount: () => events.push("unmount"),
      },
      renderer: {
        destroy: () => events.push("destroy"),
      },
      stdout: {
        isTTY: false,
        write: () => events.push("write"),
      },
      exit: (code) => {
        events.push(`exit:${code}`);
      },
    });

    expect(events).toEqual(["unmount", "destroy", "exit:0"]);
  });
});
