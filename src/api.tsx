interface AirtableRecord<Fields extends {} = {}> {
  id: string;
  createdTime: string;
  fields: Fields;
}

export type CardRecord = AirtableRecord<{
  "ID": number;
  "Representation": string;
  "Created": string;
  "Deleted?": number;
  "Text": string;
  "Stack": string;
}>;

interface ApiResponse {
  fields: CardRecord["fields"];
  records: CardRecord[];
  offset: string;
}

async function api({
  url = "",
  method,
  body,
  ...params
}: {
  [key: string]: any;
}): Promise<Partial<ApiResponse>> {
  // Remove undefined values from params
  for (let key of Object.keys(params)) {
    if (params[key] === undefined) {
      delete params[key];
    }
  }

  let response: Response = await fetch(
    `https://api.airtable.com/v0/appv8IBBNSkKbxBsq${url}` +
      `?${new URLSearchParams(params)}`,
    {
      method,
      headers: {
        "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    },
  );
  return await response.json();
}

export async function apiGetCards(stack: string) {
  let records: CardRecord[] = [];
  let offset: string | undefined;
  while (true) {
    let response = await api({
      url: "/Cards",
      view: "Not deleted",
      filterByFormula: `Stack=${JSON.stringify(stack)}`,
      offset: offset,
    });

    if (response.records == null) {
      console.error(response);
      throw new Error("API response error.");
    }

    records.push(...response.records);
    if (!response.offset) break;

    offset = response.offset;
  }

  return records;
}

export async function apiUpdateCardText(cardId: string, text: string) {
  let response = await api({
    url: `/Cards/${cardId}`,
    method: "PATCH",
    body: { fields: { Text: text } },
  });

  if (response.fields == null) {
    console.error(response);
    throw new Error("API response error.");
  }

  return response.fields;
}

export async function apiDeleteCard(cardId: string) {
  await api({
    url: `/Cards/${cardId}`,
    method: "PATCH",
    body: { fields: { Deleted: new Date() } },
  });
}

export async function apiCreateCard(stack: string, text: string) {
  let response = await api({
    url: "/Cards",
    method: "POST",
    body: { records: [{ fields: { Text: text, Stack: stack } }] },
  });

  if (response.records == null) {
    console.error(response);
    throw new Error("API response error.");
  }

  return response.records[0];
}
