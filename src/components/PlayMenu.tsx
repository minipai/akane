import React from "react";
import PickerMenu from "./PickerMenu.js";

const GAMES = [
  { label: "Tic-Tac-Toe" },
  { label: "Guess the ASCII Art" },
  { label: "Read My Mind" },
  { label: "Hangman" },
  { label: "Two Truths and a Lie" },
];

interface Props {
  onSelect: (game: string) => void;
  onCancel: () => void;
}

export default function PlayMenu({ onSelect, onCancel }: Props) {
  return (
    <PickerMenu
      title="/play ..."
      items={GAMES}
      hideCustom
      onSelect={onSelect}
      onCancel={onCancel}
    />
  );
}
