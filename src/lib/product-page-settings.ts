export type ProductPageSectionId =
  | "gallery"
  | "info"
  | "notes"
  | "description"
  | "features"
  | "apply"
  | "ingredients"
  | "legal"
  | "reviews"
  | "related";

export type NoteGroupId = "head" | "heart" | "base";

export type ProductNoteItem = {
  name: string;
  image: string;
};

export type ProductNoteGroup = {
  id: NoteGroupId;
  visible: boolean;
  title: string;
  image: string;
  notes: ProductNoteItem[];
};

export type ProductAccordionId =
  | "description"
  | "features"
  | "apply"
  | "ingredients"
  | "legal";

export type ProductAccordion = {
  id: ProductAccordionId;
  visible: boolean;
  title: string;
  content: string;
  html?: string;
  bullets?: string[];
  images?: string[];
  icons?: string[];
  defaultOpen?: boolean;
};

export const productPageSettings = {
  sections: {
    gallery: { visible: true },
    info: { visible: true },
    notes: { visible: true },
    description: { visible: true },
    features: { visible: true },
    apply: { visible: true },
    ingredients: { visible: false },
    legal: { visible: true },
    reviews: { visible: true },
    related: { visible: true },
  } satisfies Record<ProductPageSectionId, { visible: boolean }>,

  sectionOrder: [
    "gallery",
    "info",
    "notes",
    "description",
    "features",
    "apply",
    "ingredients",
    "legal",
    "reviews",
    "related",
  ] satisfies ProductPageSectionId[],

  layout: {
    containerWidth: "1280px",
    sectionGap: "64px",
    columnGap: "48px",
    padding: "24px",
    margin: "0px",
    galleryMainImageHeight: "640px",
    galleryMobileImageHeight: "420px",
    galleryImageWidth: "100%",
    galleryImageHeight: "100%",
    thumbnailSize: "76px",
    noteImageWidth: "84px",
    noteImageHeight: "64px",
    iconSize: "28px",
    borderRadius: "8px",
    shadow: "0 18px 50px rgba(0, 0, 0, 0.08)",
    fontSize: "16px",
    fontWeight: "400",
    letterSpacing: "0",
    lineHeight: "1.7",
    buttonWidth: "100%",
    buttonHeight: "56px",
    accordionHeight: "auto",
    accordionPadding: "24px",
  },

  text: {
    promo: "Free shipping on orders above Rs. 999 · Extrait de Parfum",
    backToCollections: "Collections",
    productFallbackCategory: "Extrait de Parfum",
    ratingText: "4.7",
    ratingCountText: "273",
    priceLabel: "Incl. of all taxes",
    offerText: "B1G1",
    shortDescriptionFallback:
      "Quiet luxury and effortlessly premium, composed for a long, polished trail.",
    quantityLabel: "Quantity",
    addToCart: "Add to cart",
    notesHeading: "NOTES",
    descriptionTitle: "Description",
    keyFeaturesTitle: "Key Features & Benefits",
    howToApplyTitle: "How To Apply",
    ingredientsTitle: "Ingredients",
    legalTitle: "Legal Information",
    reviewsTitle: "Customer Reviews",
    relatedTitle: "Related Products",
    emptyReviews: "Reviews can be connected from the review system when enabled.",
  },

  notes: [
    {
      id: "head",
      visible: true,
      title: "HEAD NOTES",
      image: "",
      notes: [
        { name: "Lavender", image: "" },
        { name: "Saffron", image: "" },
        { name: "Nutmeg", image: "" },
      ],
    },
    {
      id: "heart",
      visible: true,
      title: "HEART NOTES",
      image: "",
      notes: [{ name: "Agarwood (Oud)", image: "" }],
    },
    {
      id: "base",
      visible: true,
      title: "BASE NOTES",
      image: "",
      notes: [
        { name: "Patchouli", image: "" },
        { name: "Musk", image: "" },
      ],
    },
  ] satisfies ProductNoteGroup[],

  accordions: [
    {
      id: "description",
      visible: true,
      title: "Description",
      content: "",
      defaultOpen: true,
    },
    {
      id: "features",
      visible: true,
      title: "Key Features & Benefits",
      content: "",
      bullets: [
        "Premium perfume concentration.",
        "Designed for a long-lasting trail.",
        "Balanced for everyday and evening wear.",
      ],
    },
    {
      id: "apply",
      visible: true,
      title: "How To Apply",
      content:
        "Spray on pulse points such as the neck and wrists. Let the fragrance settle naturally without rubbing.",
    },
    {
      id: "ingredients",
      visible: false,
      title: "Ingredients",
      content: "Ingredient details can be added here.",
    },
    {
      id: "legal",
      visible: true,
      title: "Legal Information",
      content:
        "Country of Origin: India\nManufactured and marketed details can be edited here.",
    },
  ] as ProductAccordion[],
};
