import { motion } from "motion/react";

type StambhCoreProps = {
  active: boolean;
  onActivate: () => void;
};

export function StambhCore({ active, onActivate }: StambhCoreProps) {
  return (
    <button className={`core-stage ${active ? "is-active" : ""}`} onClick={onActivate} aria-label="Talk to Stambh">
      <motion.span
        className="orbit orbit-one"
        animate={{ rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="orbit orbit-two"
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="core-shell"
        animate={{ scale: active ? [1, 1.035, 1] : [1, 1.012, 1] }}
        transition={{ duration: active ? 1.6 : 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="core-eye">
          <span className="core-pupil" />
        </span>
      </motion.span>
      <span className="core-caption">
        <strong>STAMBH</strong>
        <small>{active ? "LISTENING" : "ONLINE · PRIVATE"}</small>
      </span>
    </button>
  );
}
