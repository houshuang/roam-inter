import { btreeDiff } from "../btreeDiff";

test("empty generates empty", () => {
  expect(
    btreeDiff(
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
        },
      ],
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
        },
      ]
    )
  ).toEqual([]);
});

test("remove 1", () => {
  expect(
    btreeDiff(
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
        },
        {
          string: "a",
          uid: "1yYP3vuz0c",
          children: [],
        },
      ],
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
        },
      ]
    )
  ).toEqual([{ type: "remove", uid: "1yYP3vuz0c" }]);
});

test("add 1", () => {
  expect(
    btreeDiff(
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
          order: 0,
        },
      ],
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
          order: 0,
        },
        {
          string: "a",
          uid: "1yYP3vuz0c",
          children: [],
          order: 1,
        },
      ]
    )
  ).toEqual([
    {
      depth: 0,
      order: 1,
      "parent-uid": undefined,
      string: "a",
      type: "create",
      uid: "1yYP3vuz0c",
    },
  ]);
});

test("insert 1 first", () => {
  expect(
    btreeDiff(
      [
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
          order: 0,
        },
      ],
      [
        {
          string: "a",
          uid: "1yYP3vuz0c",
          children: [],
          order: 0,
        },
        {
          string: "a",
          uid: "yYPVvuz0c",
          children: [],
          order: 1,
        },
      ]
    )
  ).toEqual([
    {
      depth: 0,
      order: 0,
      "parent-uid": undefined,
      string: "a",
      type: "create",
      uid: "1yYP3vuz0c",
    },
  ]);
});

test.only("insert 1 and reorder", () => {
  expect(
    btreeDiff(
      [
        {
          string: "a",
          uid: "A",
          children: [],
          order: 0,
        },
        {
          string: "b",
          uid: "B",
          children: [],
          order: 1,
        },
      ],
      [
        {
          string: "b",
          uid: "B",
          children: [],
          order: 0,
        },
        {
          string: "c",
          uid: "C",
          children: [],
          order: 1,
        },
        {
          string: "a",
          uid: "A",
          children: [],
          order: 2,
        },
      ]
    )
  ).toEqual([
    {
      depth: 0,
      order: 1,
      "parent-uid": undefined,
      string: "c",
      type: "create",
      uid: "C",
    },
    { order: 0, "parent-uid": undefined, type: "move", uid: "A" },
    { order: 1, "parent-uid": undefined, type: "move", uid: "C" },
  ]);
});
