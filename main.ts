import data from "./json/data.json";
import ligatures from "./json/ligatures.json";

type IpsumType = "Paragraphs" | "Sentences" | "Words" | "Lists";

interface Settings {
  url: string;
  nbr: number;
  type: IpsumType;
}

interface PartialResult {
  type: string;
  text: string;
  gender: string;
  number: string;
}

export default class LoremIpsum {
  private readonly dom: {
    form: HTMLFormElement;
    nbr: HTMLInputElement;
    type: NodeListOf<HTMLInputElement>;
    btn: HTMLButtonElement | null;
    content: HTMLElement;
    footer: HTMLElement;
  };

  private settings: Settings;

  private wordsArr: string[];
  private usedWords = new Map<string, number[]>();
  private usedDictionary = new Set<string>();

  constructor() {
    const form = document.querySelector<HTMLFormElement>("form");
    const nbr = document.querySelector<HTMLInputElement>('input[name="nbr"]');
    const type =
      document.querySelectorAll<HTMLInputElement>('input[name="type"]');
    const content = document.querySelector<HTMLElement>(".js-content");
    const footer = document.querySelector<HTMLElement>(".js-footer");

    if (!form || !nbr || !type.length || !content || !footer) {
      throw new Error("Missing required DOM elements.");
    }

    this.dom = {
      form,
      nbr,
      type,
      btn: document.querySelector<HTMLButtonElement>(".js-generate"),
      content,
      footer,
    };

    this.settings = {
      url: "http://sidlipsum.smnarnold.com",
      nbr: Number(nbr.value) || 1,
      type: "Paragraphs",
    };

    this.wordsArr = [
      ...data.times.m.single.item.values,
      ...data.places.m.single.item.values,
      ...data.places.f.single.item.values,
      ...data.persons.m.single.item.values,
      ...data.persons.f.single.item.values,
      ...data.roles.m.single.item.values,
      ...data.roles.f.single.item.values,
      ...data.roles.m.single.specialisation.values,
      ...data.roles.f.single.specialisation.values,
    ];
  }

  public init(): void {
    this.bindEvents();
    this.setup();
  }

  private bindEvents(): void {
    this.dom.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.setup();
    });

    this.dom.nbr.addEventListener("change", () => {
      this.settings.nbr = Number(this.dom.nbr.value) || 1;
    });

    this.dom.type.forEach((radio) =>
      radio.addEventListener("change", () => {
        this.settings.type = radio.value as IpsumType;
      }),
    );
  }

  private setup(): void {
    this.usedDictionary.clear();
    this.usedWords.clear();

    const content = Array.from({ length: this.settings.nbr }, () =>
      this.getLoremIpsum(this.settings.type),
    ).join("");

    const fixed = this.fixLigatures(content);

    this.updateResume(fixed);
    this.dom.content.innerHTML = `<article class="article">${fixed}</article>`;
  }

  private getLoremIpsum(type: IpsumType): string {
    switch (type) {
      case "Sentences":
        return this.generateSentence() + " ";
      case "Words":
        return this.randomWordFromPool() + " ";
      case "Lists":
        return `<li>${this.generateSentence()}</li>`;
      case "Paragraphs":
      default:
        return this.generateParagraph();
    }
  }

  private generateParagraph(): string {
    const sentencesNbr = this.random(2, 8);

    const sentences = Array.from({ length: sentencesNbr }, () =>
      this.generateSentence(),
    );

    return `<p>${sentences.join(" ")}</p>`;
  }

  private generateSentence(): string {
    const structure =
      data.structures[Math.floor(Math.random() * data.structures.length)];

    const parts: string[] = [];
    let protagonist = { gender: "", number: "" };

    for (let token of structure) {
      const firstChar = token.charAt(0);

      if (firstChar === "*") {
        if (Math.random() >= 1 / 6) continue;
        token = token.slice(1);
      } else if (firstChar === "?") {
        const section = this.getSection(token.slice(1), protagonist);

        if (token.slice(1) === "protagonists") {
          protagonist = {
            gender: section.gender,
            number: section.number,
          };
        }

        parts.push(section.text);
        continue;
      }

      const category = (data as any)[token];

      parts.push(category ? this.getRandomWord(token) : token);
    }

    return this.capitalize(parts.join(" "));
  }

  private getSection(originalType: string, preset = {}): PartialResult {
    const typeObj = (data as any)[originalType];

    if (typeObj.options) {
      const selected = this.randomFromArray(typeObj.options);

      if (typeof selected === "string") {
        return this.getPartial(selected, preset);
      }

      const partials = selected.map((t: string) => this.getPartial(t, preset));

      return this.mergePartials(partials, originalType, typeObj);
    }

    return this.getPartial(originalType, preset);
  }

  private getPartial(type: string, preset: any = {}): PartialResult {
    const gender = preset.gender ?? (Math.random() > 0.5 ? "m" : "f");
    const typeObj = (data as any)[type];

    const numbers = Object.keys(typeObj[gender]);
    const number =
      preset.number ?? numbers[Math.floor(Math.random() * numbers.length)];

    const obj = typeObj[gender][number];

    const text = typeObj.structure
      .map((category: string) => {
        if (obj[category].required >= Math.random()) {
          return this.getRandomNoRepeat(obj[category].values);
        }
        return obj[category].default ?? "";
      })
      .filter(Boolean)
      .join(" ");

    return { type, text, gender, number };
  }

  private mergePartials(
    arr: PartialResult[],
    type: string,
    typeObj: any,
  ): PartialResult {
    const base = { ...arr[0] };

    for (let i = 1; i < arr.length; i++) {
      if (arr[i].gender !== base.gender) base.gender = "m";
      base.text += this.randomFromArray(typeObj.sep) + arr[i].text;
    }

    base.type = type;
    base.number = "plural";

    return base;
  }

  private random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomFromArray<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private randomWordFromPool(): string {
    const item = this.randomFromArray(this.wordsArr);
    return this.randomFromArray(item.split(" "));
  }

  private getRandomNoRepeat(arr: string[]): string {
    const word = this.randomFromArray(arr);

    if (!this.usedDictionary.has(word) && word.length > 3) {
      this.usedDictionary.add(word);
      return word;
    }

    return this.randomFromArray(arr);
  }

  private getRandomWord(type: string): string {
    const list = (data as any)[type];
    const index = Math.floor(Math.random() * list.length);

    const used = this.usedWords.get(type) ?? [];

    if (!used.includes(index)) {
      used.push(index);
      if (used.length > 4) used.shift();
      this.usedWords.set(type, used);
      return list[index];
    }

    return this.getRandomWord(type);
  }

  private fixLigatures(str: string): string {
    return ligatures.reduce(
      (acc, [pattern, replacement]: [string, string]) =>
        acc.replace(new RegExp(pattern, "g"), replacement),
      str,
    );
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private updateResume(text: string): void {
    const translations: Record<IpsumType, string> = {
      Paragraphs: `${this.settings.nbr} paragraphes`,
      Sentences: `${this.settings.nbr} phrases`,
      Words: `${this.settings.nbr} mots`,
      Lists: `Une liste à ${this.settings.nbr} points`,
    };

    let resume = translations[this.settings.type];

    if (this.settings.type !== "Words") {
      resume += `, ${text.split(/\s+/).length} mots`;
    }

    resume += `, ${text.replace(/[^A-Za-z]/g, "").length} caractères de 
      <a href="${this.settings.url}">Lee<em>psum</em></a> généré`;

    this.dom.footer.innerHTML = `<p><strong>${resume}</strong></p>`;
  }
}

const leepsum = new LoremIpsum();
leepsum.init();
