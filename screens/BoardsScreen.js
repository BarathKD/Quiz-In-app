import { View, FlatList, TouchableOpacity, Text } from "react-native";
import Header from "../components/header"; // if you already have Header

const boards = ["CBSE", "ICSE", "Tamil Nadu"];

export default function BoardsScreen({ navigation }) {
  return (
    <View style={{ flex: 1 }}>
      <Header title="Select Board" />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={boards}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: "#f0f0f0",
              padding: 20,
              borderRadius: 10,
              marginBottom: 12,
            }}
            onPress={() => navigation.navigate("Classes", { board: item })}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
