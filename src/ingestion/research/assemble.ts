import {
  researchCandidateSchema,
  type MainDraft,
  type ResearchError,
  type ResearchQuestion,
} from "./contracts";
import type { TicketExecution } from "./ticket-agent";

function unique<T>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Copy whole blocks by exact identity. No factual interpretation or status inference. */
export function assembleResearch(main: MainDraft, ticket: TicketExecution) {
  const fallback = (cause: string): ResearchQuestion[] =>
    main.data?.editions
      .filter((edition) => edition.ticketResearch.state !== "not_found")
      .map((edition) => ({
        message:
          edition.ticketResearch.state === "unfinished"
            ? edition.ticketResearch.reason
            : cause,
        editionKey: edition.key,
        field: "tickets",
      })) ?? [];
  const routingQuestions =
    main.data?.editions
      .filter((edition) => edition.ticketResearch.state === "unfinished")
      .map((edition) => ({
        message: edition.ticketResearch.reason,
        editionKey: edition.key,
        field: "tickets",
      })) ?? [];
  const build = (
    batch: TicketExecution["batch"],
    questions: ResearchQuestion[],
  ) => ({
    ...main,
    data: main.data
      ? {
          ...main.data,
          editions: main.data.editions.map((draft) => {
            const edition = { ...draft };
            delete (edition as Partial<typeof draft>).ticketResearch;
            const tickets = batch?.editions.find(
              (item) => item.key === edition.key,
            )?.tickets;
            return tickets ? { ...edition, tickets } : edition;
          }),
        }
      : null,
    unresolved: unique([...main.unresolved, ...questions]),
  });
  const batchQuestions =
    ticket.batch?.editions.flatMap((edition) =>
      edition.unresolved.map((question) => ({
        ...question,
        editionKey: edition.key,
        field: "tickets",
      })),
    ) ?? [];
  let hostErrors = ticket.errors;
  let questions: ResearchQuestion[] = routingQuestions;
  if (ticket.batch) {
    questions = [...routingQuestions, ...batchQuestions];
  } else if (ticket.outcome !== "skipped") {
    questions = fallback(
      ticket.errors[0]?.message ?? "Ticket check unfinished",
    );
  }
  let candidate = build(ticket.batch, questions);
  if (
    candidate.unresolved.length > 30 ||
    candidate.errors.length + hostErrors.length > 30
  ) {
    delete ticket.batch;
    ticket.outcome = "failed";
    hostErrors = [
      {
        code: "invalid_candidate",
        stage: "validation",
        field: "tickets",
        message: "Ticket diagnostics exceed final limits",
      },
    ];
    ticket.errors = hostErrors;
    candidate = build(
      undefined,
      fallback(
        "Ticket batch rejected because its diagnostics exceed final limits",
      ),
    );
  }
  const parsed = researchCandidateSchema.safeParse(candidate);
  if (!parsed.success || candidate.errors.length + hostErrors.length > 30) {
    return {
      candidate: null,
      errors: [
        ...hostErrors,
        {
          code: "invalid_candidate",
          stage: "validation",
          message: "Assembled research candidate is invalid",
        } satisfies ResearchError,
      ],
    };
  }
  return { candidate: parsed.data, errors: hostErrors };
}
