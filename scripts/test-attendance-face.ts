import {
  euclideanDistance,
  matchFaceDescriptor,
  parseFaceDescriptor,
} from "../lib/face-descriptor";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const base = Array.from({ length: 128 }, (_, i) => i * 0.01);
const close = base.map((value, i) => value + (i === 0 ? 0.02 : 0));
const far = base.map((value) => value + 0.4);

assert(parseFaceDescriptor(base)?.length === 128, "parse 128");
assert(parseFaceDescriptor([1, 2, 3]) === null, "reject short");
assert(euclideanDistance(base, base) === 0, "same vector");

const enrolled = matchFaceDescriptor(close, [
  { personType: "student", personId: "s1", descriptor: base },
]);
assert(enrolled.matched, "close face matches enrolled person");
if (enrolled.matched) {
  assert(enrolled.personId === "s1", "matched student id");
}

const unknown = matchFaceDescriptor(far, [
  { personType: "student", personId: "s1", descriptor: base },
]);
assert(!unknown.matched, "far face is unknown");

const twins = matchFaceDescriptor(base, [
  { personType: "student", personId: "s1", descriptor: base },
  { personType: "student", personId: "s2", descriptor: close },
]);
assert(!twins.matched && twins.reason === "ambiguous", "two close faces → ambiguous");

console.log("test-attendance-face: ok");
