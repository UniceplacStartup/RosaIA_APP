import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PlaceholderScreen({ nome }: { nome: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.texto}>{nome}</Text>
      <Text style={styles.subtexto}>Tela ainda não implementada</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#8E1948", alignItems: "center", justifyContent: "center" },
  texto: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  subtexto: { color: "#F8D7E3", fontSize: 14, marginTop: 8 },
});