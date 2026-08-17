import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

const OFFSETS = {
  up: { y: 36 },
  down: { y: -24 },
  left: { x: -42 },
  right: { x: 42 },
  none: {},
};

export const staggerParent = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

function MotionTag({ as = "div", ...props }) {
  const Comp = motion[as] || motion.div;
  return <Comp {...props} />;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  as = "div",
  once = true,
  amount = 0.18,
  duration = 0.65,
  mode = "scroll",
  ...rest
}) {
  const reduce = useReducedMotion();
  const offset = OFFSETS[direction] || OFFSETS.up;

  if (reduce) {
    const Tag = as === "div" ? "div" : as;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  const motionProps =
    mode === "mount"
      ? {
          initial: { opacity: 0, ...offset },
          animate: { opacity: 1, x: 0, y: 0 },
        }
      : {
          initial: { opacity: 0, ...offset },
          whileInView: { opacity: 1, x: 0, y: 0 },
          viewport: { once, amount, margin: "0px 0px -48px 0px" },
        };

  return (
    <MotionTag
      as={as}
      className={className}
      transition={{ duration, delay, ease: EASE }}
      {...motionProps}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function Stagger({
  children,
  className = "",
  as = "div",
  delay = 0,
  amount = 0.12,
  ...rest
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as === "div" ? "div" : as;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      as={as}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount, margin: "0px 0px -40px 0px" }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.1, delayChildren: delay },
        },
      }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function Item({ children, className = "", as = "div", ...rest }) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as === "div" ? "div" : as;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag as={as} className={className} variants={staggerItem} {...rest}>
      {children}
    </MotionTag>
  );
}

export function PageEnter({ children, className = "" }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
