import { updateDepth, btreeToBArray } from "../btreeDiff";
import { blocks } from "../blockExamples";

test("simple case", () => {
  expect(
    updateDepth(btreeToBArray(blocks.a), {
      depth: 2,
      uid: "CIAHE12r8",
      "parent-uid": "r4a5_9gok",
    })
  ).toEqual([
    {
      depth: 0,
      order: 0,
      "parent-uid": undefined,
      string: "a",
      uid: "yYPVvuz0c",
    },
    {
      depth: 1,
      order: 0,
      "parent-uid": "yYPVvuz0c",
      string: "b",
      uid: "CIAHE12r8",
    },
    {
      depth: 3,
      order: 0,
      "parent-uid": "CIAHE12r8",
      string: "c",
      uid: "_GhJh5KNn",
    },
    {
      depth: 3,
      order: 1,
      "parent-uid": "CIAHE12r8",
      string: "f",
      uid: "VX2qWg5N3",
    },
    {
      depth: 4,
      order: 0,
      "parent-uid": "VX2qWg5N3",
      string: "deep",
      uid: "f09df",
    },
    {
      depth: 1,
      order: 1,
      "parent-uid": "yYPVvuz0c",
      string: "d",
      uid: "9z3WEbkGD",
    },
    {
      depth: 2,
      order: 0,
      "parent-uid": "9z3WEbkGD",
      string: "e",
      uid: "kOI5Hn-LG",
    },
    {
      depth: 3,
      order: 0,
      "parent-uid": "kOI5Hn-LG",
      string: "g",
      uid: "WWoz7KLRU",
    },
    {
      depth: 3,
      order: 1,
      "parent-uid": "kOI5Hn-LG",
      string: "h",
      uid: "x30EiL2q6",
    },
    {
      depth: 0,
      order: 1,
      "parent-uid": undefined,
      string: "f",
      uid: "7GgFBEWvw",
    },
    {
      depth: 1,
      order: 0,
      "parent-uid": "7GgFBEWvw",
      string: "e",
      uid: "r4a5_9gok",
    },
    {
      depth: 1,
      order: 1,
      "parent-uid": "7GgFBEWvw",
      string: "g",
      uid: "wYvSbkF1x",
    },
    {
      depth: 0,
      order: 3,
      "parent-uid": undefined,
      string: "r",
      uid: "2eGkUA8cH",
    },
  ]);
});
