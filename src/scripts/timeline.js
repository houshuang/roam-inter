var getDates2 = (search) => {
  const res = window.roamAlphaAPI
    .q(
      `[:find (pull ?question [:block/string :block/parents]) :in $ ?nodeTitle :where [?question :block/refs ?srPage] [?srPage :node/title ?nodeTitle] [?parent :block/parents ?question]]`,
      search
    )
    .map((b) => [
      b[0].string,
      window.roamAlphaAPI.pull("[:node/title]", b[0].parents[0].id)[
        ":node/title"
      ],
    ]);
  return res;
};
