import http from "k6/http";
import {sleep, check } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 50 },
    { duration: "10s", target: 0 },
  ],
};


export default function () {
  const res = http.get("https://scribbleup-0s2n.onrender.com/");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1); // each user waits 1 second between requests

  const res2 = http.get("https://scribbleup-0s2n.onrender.com/login");

  check(res2, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}