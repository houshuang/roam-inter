const first = (arr, low, high, x, n) => {
  if (high >= low) {
    let mid = Math.floor(low + (high - low) / 2); // (low + high)/2;
    if ((mid == 0 || x > arr[mid - 1]) && arr[mid] == x) {
      return mid;
    }
    if (x > arr[mid]) {
      return first(arr, mid + 1, high, x, n);
    }
    return first(arr, low, mid - 1, x, n);
  }
  return -1;
};

// given two arrays of uids (sets), find fewest moves to change order of b to that of b2
// # Sort A1[0..m-1] according to the order
// # defined by A2[0..n-1].
// adapted from https://www.geeksforgeeks.org/sort-array-according-order-defined-another-array/, Python version
const findMinimumMoves = (A1, A2, m, n) => {
  //The temp array is used to store a copy of A1[] and visited[] is used mark the visited elements in temp[].
  let temp = [];
  let visited = [];

  [...Array(m).keys()].forEach(i => {
    temp[i] = A1[i];
    visited[i] = 0;
  });
  temp.sort();
  let ind = 0;

  // Consider all elements of A2[], find them in temp[] and copy to A1[] in order.
  [...Array(n).keys()].forEach(i => {
    // Find index of the first occurrence of A2[i] in temp
    let f = first(temp, 0, m - 1, A2[i], m);
    // If not present, no need to proceed
    if (f == -1) {
      return;
    }
    // Copy all occurrences of A2[i] to A1[]
    let j = f;
    while (j < m && temp[j] == A2[i]) {
      console.log(ind, A1[ind], temp[j]);
      A1[ind] = temp[j];
      ind = ind + 1;
      visited[j] = 1;
      j = j + 1;
    }
  });

  // Now copy all items of temp[] which are not present in A2[]
  [...Array(m).keys()].forEach(i => {
    if (visited[i] == 0) {
      A1[ind] = temp[i];
      ind = ind + 1;
    }
  });

  console.log(A1, A2);
};
