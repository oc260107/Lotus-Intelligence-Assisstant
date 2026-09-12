import flightsData from "../data/synthetic-flights.json";

import type {
  Intent,
  Offer,
  RetrievalSummary,
} from "./model";

type SyntheticFlightRow = {
  offer_id: string;
  route: string;

  origin: string;
  destination: string;

  departure_date: string;
  departure_time_local: string;

  arrival_date: string;
  arrival_time_local: string;

  routing: string;

  stops: number;

  transit_airport: string;
  transit_airport_name: string;
  transit_city: string;

  transit_minutes: number;

  total_duration_minutes: number;
  total_duration_text: string;

  flight_reference: string;
  aircraft_reference: string;

  demo_fare_type: string;

  synthetic_price_aud: number;

  checked_baggage_kg_demo: number;

  flexibility_demo: string;

  connection_profile: string;

  reality_basis: string;

  synthetic_flag: boolean;
};

export const SYNTHETIC_FLIGHT_DATASET =
  flightsData as SyntheticFlightRow[];

function convertFlexibility(
  value: string,
): "Basic" | "Standard" | "Flexible" {
  const text = value.toLowerCase();

  if (text.includes("more flexible")) {
    return "Flexible";
  }

  if (text.includes("condition")) {
    return "Standard";
  }

  return "Basic";
}

function constraintScore(
  offer: Omit<Offer, "score">,
  intent: Intent,
) {
  const checks = [
    offer.price <= intent.budget,
    offer.transit <= intent.transit,
    offer.baggage >= intent.baggage,
  ];

  const passed = checks.filter(Boolean).length;

  return Math.round(
    (passed / checks.length) * 100,
  );
}

export function retrieveSyntheticOffers(
  intent: Intent,
): {
  offers: Offer[];
  summary: RetrievalSummary;
} {
  const routeMatches =
    SYNTHETIC_FLIGHT_DATASET.filter(
      (flight) =>
        flight.origin === intent.from &&
        flight.destination === intent.to,
    );

  const dateMatches =
    routeMatches.filter((flight) => {
      const afterStart =
        !intent.start ||
        flight.departure_date >= intent.start;

      const beforeEnd =
        !intent.end ||
        flight.departure_date <= intent.end;

      return afterStart && beforeEnd;
    });

  const offers: Offer[] =
    dateMatches
      .map((flight) => {
        const transitHours =
          flight.transit_minutes / 60;

        const totalHours =
          flight.total_duration_minutes / 60;

        const totalPrice =
          flight.synthetic_price_aud *
          intent.passengers;

        const raw: Omit<Offer, "score"> = {
          id: flight.offer_id,

          datasetId: flight.offer_id,

          label:
            flight.stops === 0
              ? `Direct · ${flight.demo_fare_type}`
              : `Via ${flight.transit_airport} · ${flight.demo_fare_type}`,

          price: totalPrice,

          transit: Number(
            transitHours.toFixed(2),
          ),

          hours: Number(
            totalHours.toFixed(2),
          ),

          baggage:
            flight.checked_baggage_kg_demo,

          // Dataset hiện tại không có Lotusmiles thật.
          // Không tự bịa miles.
          miles: 0,

          flight:
            flight.flight_reference,

          departureTime:
            `${flight.departure_date} ${flight.departure_time_local}`,

          arrivalTime:
            `${flight.arrival_date} ${flight.arrival_time_local}`,

          stops:
            flight.stops,

          flexibility:
            convertFlexibility(
              flight.flexibility_demo,
            ),

          source:
            "synthetic-demo-dataset",
        };

        return {
          ...raw,
          score:
            constraintScore(
              raw,
              intent,
            ),
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (a.price !== b.price) {
          return a.price - b.price;
        }

        return a.hours - b.hours;
      })
      .slice(0, 6);

  return {
    offers,

    summary: {
      source:
        "synthetic-demo-dataset",

      datasetSize:
        SYNTHETIC_FLIGHT_DATASET.length,

      routeMatches:
        routeMatches.length,

      shown:
        offers.length,
    },
  };
}