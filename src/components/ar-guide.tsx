"use client";
import { ArView } from "@/components/ar-view";
import { useStored } from "@/lib/client/stored";
import { relativeAngle, turnFor } from "@/lib/floor/bearing";
import type { Turn } from "@/lib/floor/types";

type Props = {
  /** Compass direction of the leg to walk now, on the map (degrees clockwise from the top of the map). Null when there is nothing to walk on this floor. */
  bearing: number | null;
  /** Length of that leg. */
  metres: number | null;
  /** Where the leg leads, for the caption: "South-east staircase". */
  towards: string;
  /** The route carries on downstairs from here. */
  goingDown: boolean;
  /** Turn for this step, used when the phone has no compass. */
  fallbackTurn?: Turn;
  className?: string;
};

export const TURN_TEXT: Record<Turn, string> = { straight: "Straight ahead", left: "Turn left", right: "Turn right", back: "Turn around" };
export const TURN_DEGREES: Record<Turn, number> = { straight: 0, right: 90, back: 180, left: -90 };
const NORTH_KEY = "safeway.map-north";

/**
 * Camera view for a route worked out on the floor map: the arrow points along the next leg.
 *
 * What it does and doesn't do: the arrow is steered by the phone's compass and the route on the map.
 * It does not recognise the corridor in the picture, and it does not know where the person is standing:
 * they still press Next step at each checkpoint.
 */
export function ArGuide({ bearing, metres, towards, goingDown, fallbackTurn, className }: Props) {
  // How far the top of the map is from true north. A property of the building, not of the person, so it may be remembered.
  const { value: savedNorth, save: saveNorth } = useStored<number>(NORTH_KEY);
  const north = savedNorth ?? 0;

  return (
    <ArView
      className={className}
      intro="See the arrow on the floor in front of you."
      withoutCompass="arrow shows this step's turn"
      guide={(heading) => {
        if (bearing === null) return { offset: null, symbol: goingDown ? "down" : undefined, caption: goingDown ? "Go down from here" : "You are here" };
        const offset = heading === null ? TURN_DEGREES[fallbackTurn ?? "straight"] : relativeAngle(bearing + north, heading);
        return { offset, caption: TURN_TEXT[turnFor(offset)], detail: metres === null ? undefined : `${metres} m to ${towards}` };
      }}
      action={(heading) =>
        bearing === null ? null : { label: "Arrow wrong? Face along the route, then press here", run: () => saveNorth(relativeAngle(heading, bearing)) }
      }
    />
  );
}
